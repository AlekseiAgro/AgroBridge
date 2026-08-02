import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { AuthTokenResponse, Locale, PublicUser } from '@agrobridge/shared';
import { DEFAULT_LOCALE, isLocale, isRegisterableRole } from '@agrobridge/shared';
import { LocaleCode, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role as UserRole,
        locale: locale as LocaleCode,
        displayName: dto.displayName?.trim() || null,
      },
    });

    return this.issueToken(this.toAuthenticatedUser(user));
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

    return this.issueToken(this.toAuthenticatedUser(user));
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toPublicUser(this.toAuthenticatedUser(user));
  }

  private issueToken(user: AuthenticatedUser): AuthTokenResponse {
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
      user: this.toPublicUser(user),
    };
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    role: UserRole;
    locale: LocaleCode;
    displayName: string | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale as Locale,
      displayName: user.displayName,
    };
  }

  private toPublicUser(user: AuthenticatedUser): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      displayName: user.displayName,
    };
  }

  private resolveLocale(value?: string): Locale {
    if (value && isLocale(value)) {
      return value;
    }
    return DEFAULT_LOCALE;
  }
}
