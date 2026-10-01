import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { LOCALES } from '@agrobridge/shared';
import { IndexNowService } from './indexnow.service';

const KEY = 'indexnow-test-key';
const ORIGIN = 'https://agrobridge.ge';
const PRODUCT_ID = 'product01';
const FARM_ID = 'farm0001';
const REQUEST_ID = 'request01';

function configOf(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

function enabledConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return configOf({
    INDEXNOW_ENABLED: 'true',
    INDEXNOW_KEY: KEY,
    WEB_PUBLIC_URL: ORIGIN,
    ...overrides,
  });
}

describe('IndexNowService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let warn: jest.SpiedFunction<Logger['warn']>;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    warn.mockRestore();
  });

  function serviceWith(
    config: ConfigService,
    fetchImpl: typeof fetch = jest.fn(),
  ): { service: IndexNowService; fetchImpl: jest.MockedFunction<typeof fetch> } {
    const service = new IndexNowService(config);
    const mocked = fetchImpl as jest.MockedFunction<typeof fetch>;
    service.setFetchForTests(mocked);
    return { service, fetchImpl: mocked };
  }

  it('does nothing when INDEXNOW_ENABLED is not true', async () => {
    process.env.NODE_ENV = 'production';
    const fetchImpl = jest.fn();
    const { service } = serviceWith(
      enabledConfig({ INDEXNOW_ENABLED: 'false' }),
      fetchImpl,
    );

    await expect(service.submitProduct(PRODUCT_ID)).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does nothing outside production', async () => {
    process.env.NODE_ENV = 'test';
    const fetchImpl = jest.fn();
    const { service } = serviceWith(enabledConfig(), fetchImpl);

    await service.submitProduct(PRODUCT_ID);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does nothing when the key is missing', async () => {
    process.env.NODE_ENV = 'production';
    const fetchImpl = jest.fn();
    const { service } = serviceWith(enabledConfig({ INDEXNOW_KEY: '  ' }), fetchImpl);

    await service.submitFarm(FARM_ID);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts one batch of seven localized URLs for a product, farm, and purchase request', async () => {
    process.env.NODE_ENV = 'production';
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const { service } = serviceWith(enabledConfig(), fetchImpl);

    await service.submitProduct(PRODUCT_ID);
    await service.submitFarm(FARM_ID);
    await service.submitPurchaseRequest(REQUEST_ID);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const bodies = fetchImpl.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      expect(call[0]).toBe('https://api.indexnow.org/indexnow');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json; charset=utf-8' });
      return JSON.parse(String(init.body)) as {
        host: string;
        key: string;
        keyLocation: string;
        urlList: string[];
      };
    });

    expect(bodies[0]).toEqual({
      host: 'agrobridge.ge',
      key: KEY,
      keyLocation: `${ORIGIN}/${KEY}.txt`,
      urlList: LOCALES.map((locale) => `${ORIGIN}/${locale}/products/${PRODUCT_ID}`),
    });
    expect(bodies[0].urlList).toEqual([
      `${ORIGIN}/ka/products/${PRODUCT_ID}`,
      `${ORIGIN}/en/products/${PRODUCT_ID}`,
      `${ORIGIN}/ru/products/${PRODUCT_ID}`,
      `${ORIGIN}/de/products/${PRODUCT_ID}`,
      `${ORIGIN}/fr/products/${PRODUCT_ID}`,
      `${ORIGIN}/it/products/${PRODUCT_ID}`,
      `${ORIGIN}/es/products/${PRODUCT_ID}`,
    ]);
    expect(bodies[1].urlList).toEqual(
      LOCALES.map((locale) => `${ORIGIN}/${locale}/farms/${FARM_ID}`),
    );
    expect(bodies[2].urlList).toEqual(
      LOCALES.map((locale) => `${ORIGIN}/${locale}/requests/${REQUEST_ID}`),
    );
    expect(bodies[1].urlList).toHaveLength(7);
    expect(bodies[2].urlList).toHaveLength(7);
  });

  it('does not throw when IndexNow responds with an error', async () => {
    process.env.NODE_ENV = 'production';
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const { service } = serviceWith(enabledConfig(), fetchImpl);

    await expect(service.submitProduct(PRODUCT_ID)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY);
  });

  it('does not throw or log the key when the HTTP client fails', async () => {
    process.env.NODE_ENV = 'production';
    const fetchImpl = jest.fn().mockRejectedValue(new Error(`down ${KEY}`));
    const { service } = serviceWith(enabledConfig(), fetchImpl);

    await expect(service.submitPurchaseRequest(REQUEST_ID)).resolves.toBeUndefined();
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('IndexNow notification failed');
    expect(logged).not.toContain(KEY);
  });
});
