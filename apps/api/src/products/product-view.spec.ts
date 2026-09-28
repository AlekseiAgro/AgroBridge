import { createHash } from 'crypto';
import { productViewVisitorKey } from './product-view';

describe('productViewVisitorKey', () => {
  it('keys signed-in visitors by user id so seller and buyer stay distinct', () => {
    expect(
      productViewVisitorKey({
        userId: 'u1',
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe('user:u1');
  });

  it('hashes guest IP and user-agent instead of storing them', () => {
    const key = productViewVisitorKey({
      userId: null,
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    });
    const digest = createHash('sha256').update('203.0.113.10\nMozilla/5.0').digest('hex');
    expect(key).toBe(`guest:${digest}`);
    expect(key).not.toContain('203.0.113.10');
    expect(key).not.toContain('Mozilla');
  });
});
