import { getFarm, getProduct, productDetailAuth, productDetailPath } from './api';

describe('getFarm', () => {
  it('keeps the selected locale on the public farm request', async () => {
    const request = jest.fn().mockResolvedValue(null);
    const api = { request } as never;

    await getFarm(api, 'farm/1', 'ka');

    expect(request).toHaveBeenCalledWith('/farms/farm%2F1?locale=ka', { auth: false });
  });
});

describe('product detail request', () => {
  it('asks for the product id and sends the session when the viewer is signed in', async () => {
    const request = jest.fn().mockResolvedValue({ id: 'prod_tea', title: 'Green tea' });
    const api = { request } as never;

    expect(productDetailPath('prod_tea', 'ru')).toBe('/products/prod_tea?locale=ru');
    expect(productDetailAuth(false, false)).toBe(false);
    expect(productDetailAuth(false, true)).toBe(true);
    expect(productDetailAuth(true, false)).toBe(true);

    await getProduct(api, 'prod_tea', 'ru', productDetailAuth(false, true));

    expect(request).toHaveBeenCalledWith('/products/prod_tea?locale=ru', { auth: true });
  });
});
