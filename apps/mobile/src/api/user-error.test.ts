import { ApiError } from './errors';
import { failureMessageKey } from './user-error';

function http(status: number): ApiError {
  return new ApiError({ message: 'server', status, kind: 'http' });
}

describe('failure messages', () => {
  it('does not call a wrong password a network error', () => {
    expect(failureMessageKey(http(401), 'credentials')).toBe('errors.incorrectPassword');
    expect(failureMessageKey(http(401), 'deleteConfirm')).toBe('errors.incorrectPassword');
  });

  it('maps an invalid or expired delete code separately from a network failure', () => {
    expect(failureMessageKey(http(400), 'deleteConfirm')).toBe('errors.invalidCode');
  });

  it('distinguishes authorization, missing records, conflicts, and rate limits', () => {
    expect(failureMessageKey(http(403))).toBe('errors.forbidden');
    expect(failureMessageKey(http(404))).toBe('errors.notFound');
    expect(failureMessageKey(http(409))).toBe('errors.conflict');
    expect(failureMessageKey(http(429))).toBe('errors.rateLimit');
    expect(failureMessageKey(http(400))).toBe('errors.validation');
    expect(failureMessageKey(http(500))).toBe('errors.generic');
  });

  it('uses the network message only when the request did not reach the API', () => {
    expect(
      failureMessageKey(new ApiError({ message: 'down', status: 0, kind: 'network' })),
    ).toBe('errors.network');
    expect(failureMessageKey(new Error('offline'))).toBe('errors.network');
  });
});
