import type {
  AuthTokenResponse,
  BuyerType,
  Locale,
  PublicUser,
  SellerType,
} from '@agrobridge/shared';
import { DEFAULT_LOCALE, isLocale, isRegisterableRole } from '@agrobridge/shared';
import { ConflictException, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  LocaleCode,
  SellerType as PrismaSellerType,
  BuyerType as PrismaBuyerType,
  UserRole,
} from '@prisma/client';
import { UNKNOWN_IP } from '../http/client-ip';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService, type RateLimitRequest } from '../rate-limit/rate-limit.service';
import { VerificationService } from '../verification/verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly verification: VerificationService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async register(dto: RegisterDto, ip?: string | null): Promise<AuthTokenResponse> {
    if (!isRegisterableRole(dto.role)) {
      throw new ConflictException('Invalid role for registration');
    }

    // Charged before the duplicate-email check so probing for existing accounts costs quota.
    await this.rateLimit.consume(this.registerRules(ip));

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const locale = this.resolveLocale(dto.locale);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Role is for registration stats (seller vs buyer). Seller/buyer subtypes are filled later in the cabinet.
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role as UserRole,
        sellerType: null,
        buyerType: null,
        locale: locale as LocaleCode,
        displayName: dto.displayName?.trim() || null,
      },
    });

    const authUser = this.toAuthenticatedUser(user);

    // Never block registration on outbound mail (broken/slow SMTP caused Cloudflare HTML 524s).
    void this.notifications
      .notifyWelcome({
        email: user.email,
        locale: user.locale,
        displayName: user.displayName,
        role: user.role,
      })
      .catch(() => undefined);

    void this.verification.sendEmailCode(authUser, ip).catch(() => undefined);

    return this.issueToken(authUser, 0);
  }

  async login(dto: LoginDto, ip?: string | null): Promise<AuthTokenResponse> {
    const email = dto.email.trim().toLowerCase();

    // Counted up front: an attempt that is never answered must still cost the attacker.
    const accountRule = this.loginAccountRule(ip, email);
    await this.rateLimit.consume([accountRule, this.loginIpRule(ip)]);

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.blockedAt) {
      throw new UnauthorizedException(
        user.blockedReason?.trim() || 'This account has been blocked',
      );
    }

    // A correct password clears the budget, so a few typos never lock out the real owner.
    // The wider per-IP counter is deliberately left alone: one account the attacker does
    // own must not buy them a fresh spraying budget.
    await this.rateLimit.reset([accountRule]);

    return this.issueToken(this.toAuthenticatedUser(user), user.authVersion ?? 0);
  }

  /**
   * Keyed on IP *and* email so a stranger cannot lock a victim out of their own account
   * from a foreign address, while still stopping a password guesser cold.
   */
  private loginAccountRule(ip: string | null | undefined, email: string): RateLimitRequest {
    return {
      action: 'auth.login',
      scope: { ip: ip ?? UNKNOWN_IP, email },
      ...this.rateLimit.limits.policy('loginPerAccount'),
    };
  }

  /** Catches spraying that walks through many different emails from one address. */
  private loginIpRule(ip: string | null | undefined): RateLimitRequest {
    return {
      action: 'auth.login.ip',
      scope: { ip: ip ?? UNKNOWN_IP },
      ...this.rateLimit.limits.policy('loginPerIp'),
    };
  }

  private registerRules(ip: string | null | undefined): RateLimitRequest[] {
    return [
      {
        action: 'auth.register.ip',
        scope: { ip: ip ?? UNKNOWN_IP },
        ...this.rateLimit.limits.policy('registerPerIp'),
      },
    ];
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.blockedAt) {
      throw new UnauthorizedException(
        user.blockedReason?.trim() || 'This account has been blocked',
      );
    }
    return this.toPublicUser(this.toAuthenticatedUser(user));
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    _ip?: string | null,
  ): Promise<AuthTokenResponse> {
    const accountRule: RateLimitRequest = {
      action: 'auth.password-change.account',
      scope: { account: userId },
      ...this.rateLimit.limits.policy('passwordChangePerAccount'),
    };
    await this.rateLimit.consume([accountRule]);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Incorrect password');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a different password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      return next;
    });

    await this.rateLimit.reset([accountRule]);
    return this.issueToken(this.toAuthenticatedUser(updated), updated.authVersion);
  }

  private async issueToken(
    user: AuthenticatedUser,
    authVersion = 0,
  ): Promise<AuthTokenResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      ver: authVersion,
    };

    const expiresIn = this.config.get<string>('JWT_EXPIRES_SECONDS') ?? String(60 * 60 * 24 * 7);
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: await this.toPublicUser(user),
    };
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    role: UserRole;
    sellerType?: PrismaSellerType | null;
    buyerType?: PrismaBuyerType | null;
    locale: LocaleCode;
    displayName: string | null;
    avatarUrl?: string | null;
    emailVerifiedAt?: Date | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sellerType: (user.sellerType as SellerType | null | undefined) ?? null,
      buyerType: (user.buyerType as BuyerType | null | undefined) ?? null,
      locale: user.locale as Locale,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private async toPublicUser(user: AuthenticatedUser): Promise<PublicUser> {
    const aggregate = await this.prisma.rating.aggregate({
      where: { toUserId: user.id },
      _avg: { score: true },
      _count: { _all: true },
    });
    const count = aggregate._count._all;
    const average =
      count === 0 || aggregate._avg.score == null
        ? null
        : Math.round(aggregate._avg.score * 10) / 10;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sellerType: user.sellerType,
      buyerType: user.buyerType,
      locale: user.locale,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      rating: { average, count },
    };
  }

  private resolveLocale(value?: string): Locale {
    if (value && isLocale(value)) {
      return value;
    }
    return DEFAULT_LOCALE;
  }
}
