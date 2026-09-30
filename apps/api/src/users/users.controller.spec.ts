import { UsersController } from './users.controller';

describe('UsersController public profile', () => {
  const usersService = {
    getPublicProfile: jest.fn().mockResolvedValue({ id: 'u1', farm: null }),
  };
  const controller = new UsersController(usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes an explicit locale and stays available without a signed-in user', async () => {
    await controller.getPublicProfile('u1', 'de', { user: undefined } as never);

    expect(usersService.getPublicProfile).toHaveBeenCalledWith('u1', 'de', undefined);
  });

  it('passes the authenticated viewer locale when the query omits locale', async () => {
    await controller.getPublicProfile('u1', undefined, { user: { locale: 'ka' } } as never);

    expect(usersService.getPublicProfile).toHaveBeenCalledWith('u1', undefined, 'ka');
  });
});
