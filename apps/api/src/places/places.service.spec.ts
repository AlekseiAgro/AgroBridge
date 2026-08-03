import { PlacesService } from './places.service';

describe('PlacesService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns disabled when Google Maps API key is missing', async () => {
    const service = new PlacesService({
      get: () => undefined,
    } as never);

    await expect(service.autocomplete('Telavi')).resolves.toEqual({
      enabled: false,
      suggestions: [],
    });
  });

  it('maps Google city predictions to settlement suggestions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ_telavi',
              text: { text: 'Telavi, Georgia' },
              structuredFormat: {
                mainText: { text: 'Telavi' },
                secondaryText: { text: 'Georgia' },
              },
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const service = new PlacesService({
      get: (key: string) => (key === 'GOOGLE_MAPS_API_KEY' ? 'test-key' : undefined),
    } as never);

    await expect(
      service.autocomplete('Tel', { language: 'ru', country: 'Georgia' }),
    ).resolves.toEqual({
      enabled: true,
      suggestions: [
        {
          placeId: 'ChIJ_telavi',
          label: 'Telavi, Georgia',
          mainText: 'Telavi',
          secondaryText: 'Georgia',
        },
      ],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-key',
        }),
      }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      includedPrimaryTypes: string[];
      includedRegionCodes: string[];
      languageCode: string;
    };
    expect(body.includedPrimaryTypes).toEqual([
      'locality',
      'administrative_area_level_3',
      'administrative_area_level_2',
    ]);
    expect(body.includedRegionCodes).toEqual(['ge']);
    expect(body.languageCode).toEqual('ru');
  });

  it('skips short queries without calling Google', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const service = new PlacesService({
      get: () => 'test-key',
    } as never);

    await expect(service.autocomplete('T')).resolves.toEqual({
      enabled: true,
      suggestions: [],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
