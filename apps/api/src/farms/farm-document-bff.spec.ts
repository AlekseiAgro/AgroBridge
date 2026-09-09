import {
  farmDocumentUpstreamPath,
  isFarmDocumentId,
  proxyFarmDocumentFile,
} from '../../../web/src/lib/farm-document-bff';

describe('farm-document BFF proxy', () => {
  const apiBaseUrl = 'http://api.internal:3001/api';

  it('rejects unauthenticated browser requests before calling the API', async () => {
    const fetchImpl = jest.fn();
    const response = await proxyFarmDocumentFile({
      documentId: 'doc1',
      token: null,
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('forwards an authorized download and forces private cache headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(Buffer.from('pdf-bytes'), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="id.pdf"',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=86400',
        },
      }),
    );

    const response = await proxyFarmDocumentFile({
      documentId: 'doc1',
      token: 'owner-jwt',
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(`${apiBaseUrl}/farms/documents/doc1/file`, {
      method: 'GET',
      headers: { Authorization: 'Bearer owner-jwt' },
      cache: 'no-store',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    await expect(response.text()).resolves.toBe('pdf-bytes');
  });

  it('propagates an unauthorized API response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 404 }));

    const response = await proxyFarmDocumentFile({
      documentId: 'doc1',
      token: 'other-jwt',
      apiBaseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(response.status).toBe(404);
  });

  it('does not fetch an arbitrary upstream URL (SSRF)', async () => {
    const fetchImpl = jest.fn();

    for (const documentId of [
      'http://evil.example/secret',
      '../etc/passwd',
      'doc1/../../admin',
      'doc1?host=evil',
    ]) {
      fetchImpl.mockClear();
      const response = await proxyFarmDocumentFile({
        documentId,
        token: 'owner-jwt',
        apiBaseUrl,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(isFarmDocumentId(documentId)).toBe(false);
      expect(response.status).toBe(404);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('builds the upstream path only from a validated document id', () => {
    expect(farmDocumentUpstreamPath('doc1')).toBe('/farms/documents/doc1/file');
    expect(farmDocumentUpstreamPath('doc1')).not.toContain('://');
  });
});
