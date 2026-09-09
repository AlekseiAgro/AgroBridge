import {
  isProductCertificateId,
  productCertificateUpstreamPath,
  proxyProductCertificateFile,
} from '../../../web/src/lib/product-certificate-bff';

describe('product-certificate BFF proxy', () => {
  const apiBaseUrl = 'http://api.internal:3001/api';

  it('returns 401 for an unauthenticated pending download when the API says 401', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const response = await proxyProductCertificateFile({
      productId: 'prod1',
      certificateId: 'cert1',
      token: null,
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(response.status).toBe(401);
  });

  it('forwards an authorized private download and forces no-store cache headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(Buffer.from('pdf-bytes'), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Cache-Control': 'public, max-age=86400',
        },
      }),
    );

    const response = await proxyProductCertificateFile({
      productId: 'prod1',
      certificateId: 'cert1',
      token: 'owner-jwt',
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${apiBaseUrl}/products/prod1/certificates/cert1/file`,
      {
        method: 'GET',
        headers: expect.any(Headers),
        cache: 'no-store',
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    await expect(response.text()).resolves.toBe('pdf-bytes');
  });

  it('allows an unauthenticated fetch of an approved public file', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(Buffer.from('ok'), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );
    const response = await proxyProductCertificateFile({
      productId: 'prod1',
      certificateId: 'cert1',
      token: null,
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(response.status).toBe(200);
    const init = fetchImpl.mock.calls[0][1] as { headers: Headers };
    expect(init.headers.get('Authorization')).toBeNull();
  });

  it('does not fetch an arbitrary upstream URL (SSRF)', async () => {
    const fetchImpl = jest.fn();
    for (const certificateId of [
      'http://evil.example/secret',
      '../etc/passwd',
      'doc1/../../admin',
      'doc1?host=evil',
    ]) {
      fetchImpl.mockClear();
      const response = await proxyProductCertificateFile({
        productId: 'prod1',
        certificateId,
        token: 'owner-jwt',
        apiBaseUrl,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(isProductCertificateId(certificateId)).toBe(false);
      expect(response.status).toBe(404);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('builds the upstream path only from validated ids', () => {
    expect(productCertificateUpstreamPath('prod1', 'cert1')).toBe(
      '/products/prod1/certificates/cert1/file',
    );
    expect(productCertificateUpstreamPath('prod1', 'cert1')).not.toContain('://');
  });

  it('denies a 403/404 upstream response without leaking the body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response('secret-storage-key', { status: 404 }),
    );
    const response = await proxyProductCertificateFile({
      productId: 'prod1',
      certificateId: 'cert1',
      token: 'stranger-jwt',
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });
});
