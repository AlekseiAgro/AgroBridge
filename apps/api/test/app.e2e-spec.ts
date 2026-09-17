import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthModule } from './../src/health/health.module';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * The probe answers for the database, so the database is what is faked here. A real client
 * would make this suite need a running Postgres to assert something that is about the HTTP
 * contract, not about SQL.
 */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = { $queryRaw: jest.fn(), $connect: jest.fn(), $disconnect: jest.fn() };

  async function bootstrap(): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('/api/health (GET) reports ok while the database answers', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await bootstrap();

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('ok');
        expect(res.body.locales).toEqual(['ka', 'en', 'ru', 'de', 'fr', 'it', 'es']);
      });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('/api/health (GET) answers 503 when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    await bootstrap();

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect((res) => {
        expect(res.body.status).toBe('error');
        expect(res.body.database).toBe('unavailable');
      });
  });
});
