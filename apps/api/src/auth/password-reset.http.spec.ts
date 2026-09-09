import { UnauthorizedException, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';

async function buildApp(): Promise<NestExpressApplication> {
  const passwordReset = {
    requestReset: jest.fn().mockResolvedValue({ ok: true }),
    resetPassword: jest.fn().mockResolvedValue({ ok: true }),
  };
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    getMe: jest.fn(),
    changePassword: jest.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: PasswordResetService, useValue: passwordReset },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const header = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>()
          .headers?.authorization;
        if (!header) {
          throw new UnauthorizedException();
        }
        return true;
      },
    })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return app;
}

describe('password recovery HTTP', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts forgot-password for any well-formed email without extra fields', async () => {
    const existing = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'farmer@example.com' })
      .expect(200);
    const missing = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);

    expect(existing.body).toEqual({ ok: true });
    expect(missing.body).toEqual({ ok: true });
  });

  it('rejects a short new password before touching the token', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(32), password: 'short' })
      .expect(400);
  });

  it('rejects unauthenticated password changes', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .send({ currentPassword: 'password1', newPassword: 'newpass12' })
      .expect(401);
  });
});
