import { LocaleCode, MessageTranslationStatus } from '@prisma/client';
import {
  CatalogTranslationService,
  productSourceHash,
} from './catalog-translation.service';

describe('CatalogTranslationService', () => {
  const hash = productSourceHash({
    title: 'ყურძენი',
    description: null,
    variety: null,
    originPlace: null,
  });

  function completed(locale: LocaleCode) {
    return {
      locale,
      status: MessageTranslationStatus.completed,
      sourceHash: hash,
    };
  }

  const product = {
    id: 'p1',
    title: 'ყურძენი',
    description: null,
    variety: null,
    originPlace: null,
    sourceLocale: LocaleCode.ka,
    owner: { locale: LocaleCode.ka },
    translations: [
      completed(LocaleCode.en),
      completed(LocaleCode.ru),
      completed(LocaleCode.de),
      completed(LocaleCode.fr),
      completed(LocaleCode.it),
      completed(LocaleCode.es),
    ],
  };

  const prisma = {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    productTranslation: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    purchaseRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    purchaseRequestTranslation: {
      upsert: jest.fn(),
    },
  };
  const translation = {
    providerName: 'mock',
    translateText: jest.fn(),
  };

  const service = new CatalogTranslationService(prisma as never, translation as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.productTranslation.upsert.mockResolvedValue({});
    prisma.productTranslation.update.mockResolvedValue({});
    translation.translateText.mockResolvedValue({
      translatedText: 'виноград',
      provider: 'mock',
    });
  });

  it('does not call the provider when completed translations still match the source', async () => {
    await service.syncProduct('p1');
    expect(translation.translateText).not.toHaveBeenCalled();
    expect(prisma.productTranslation.upsert).not.toHaveBeenCalled();
  });

  it('requeues translations when a source field changes', async () => {
    prisma.product.findUnique.mockResolvedValue({
      ...product,
      title: 'ყურძენი აჭარული',
      translations: product.translations.map((row) => ({ ...row, sourceHash: 'stale' })),
    });

    await service.syncProduct('p1');

    expect(translation.translateText).toHaveBeenCalled();
    expect(prisma.productTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: MessageTranslationStatus.pending }),
      }),
    );
    expect(prisma.productTranslation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MessageTranslationStatus.completed,
          title: 'виноград',
        }),
      }),
    );
  });

  it('marks the translation failed and leaves the original product in place when the provider throws', async () => {
    prisma.product.findUnique.mockResolvedValue({
      ...product,
      translations: [],
    });
    translation.translateText.mockRejectedValue(new Error('provider down'));

    await service.syncProduct('p1');

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.productTranslation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MessageTranslationStatus.failed,
          error: 'provider down',
        }),
      }),
    );
  });
});
