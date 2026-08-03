import type { AuthTokenResponse, BuyerType, Locale, PublicUser, SellerType } from '@agrobridge/shared';
import {
  DEFAULT_LOCALE,
  isLocale,
  isRegisterableRole,
} from '@agrobridge/shared';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  LocaleCode,
  SellerType as PrismaSellerType,
  BuyerType as PrismaBuyerType,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly verification: VerificationService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    if (!isRegisterableRole(dto.role)) {
      throw new ConflictException('Invalid role for registration');
    }

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

    void this.verification.sendEmailCode(authUser).catch(() => undefined);

    return this.issueToken(authUser);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const email = dto.email.trim().toLowerCase();
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

    return this.issueToken(this.toAuthenticatedUser(user));
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

  private async issueToken(user: AuthenticatedUser): Promise<AuthTokenResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
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
