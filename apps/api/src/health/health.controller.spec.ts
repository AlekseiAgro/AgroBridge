import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok status when the database answers', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('ok');
    expect(result.service).toBe('agrobridge-api');
    expect(result.locales).toContain('ka');
    expect(result.locales).toContain('es');
  });

  it('actually queries the database rather than reporting health blindly', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await controller.check();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports 503 when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not stay green while the database hangs', async () => {
    jest.useFakeTimers();
    prisma.$queryRaw.mockReturnValue(new Promise(() => {}));

    const pending = controller.check();
    const assertion = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(3000);
    await assertion;

    jest.useRealTimers();
  });
});
