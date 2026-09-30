import { getFarm } from './api';

describe('getFarm', () => {
  it('keeps the selected locale on the public farm request', async () => {
    const request = jest.fn().mockResolvedValue(null);
    const api = { request } as never;

    await getFarm(api, 'farm/1', 'ka');

    expect(request).toHaveBeenCalledWith('/farms/farm%2F1?locale=ka', { auth: false });
  });
});
