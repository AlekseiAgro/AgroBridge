import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

const VALID_REGISTER = {
  email: 'new@example.com',
  password: 'password1',
  role: 'buyer',
  acceptTerms: true,
  acceptedTermsVersion: '1.0',
  acceptedTermsLocale: 'en',
};

async function buildApp(authService = { register: jest.fn().mockResolvedValue({ accessToken: 't' }) }) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: authService },
      {
        provide: PasswordResetService,
        useValue: { requestReset: jest.fn(), resetPassword: jest.fn() },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return { app, authService };
}

describe('registration HTTP Terms acceptance', () => {
  it('rejects registration when Terms are not accepted', async () => {
    const { app, authService } = await buildApp();
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...VALID_REGISTER, acceptTerms: false })
      .expect(400);
    expect(authService.register).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects registration when the Terms checkbox field is missing', async () => {
    const { app, authService } = await buildApp();
    const { acceptTerms: _omit, ...withoutTerms } = VALID_REGISTER;
    await request(app.getHttpServer()).post('/api/auth/register').send(withoutTerms).expect(400);
    expect(authService.register).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects registration without an accepted Terms version', async () => {
    const { app, authService } = await buildApp();
    const { acceptedTermsVersion: _omit, ...withoutVersion } = VALID_REGISTER;
    await request(app.getHttpServer()).post('/api/auth/register').send(withoutVersion).expect(400);
    expect(authService.register).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects an unsupported Terms locale instead of inventing one', async () => {
    const { app, authService } = await buildApp();
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...VALID_REGISTER, acceptedTermsLocale: 'ru' })
      .expect(400);
    expect(authService.register).not.toHaveBeenCalled();
    await app.close();
  });

  it('accepts registration when Terms acceptance is present', async () => {
    const { app, authService } = await buildApp();
    await request(app.getHttpServer()).post('/api/auth/register').send(VALID_REGISTER).expect(201);
    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedTermsLocale: 'en',
      }),
      expect.anything(),
    );
    await app.close();
  });
});
