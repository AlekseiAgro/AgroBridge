import { createHash } from 'crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  CATALOG_LOCALES,
  detectCatalogSourceLocale,
  PRODUCT_DESCRIPTION_I18N,
  PRODUCT_TITLE_I18N,
  type Locale,
} from '@agrobridge/shared';
import { LocaleCode, MessageTranslationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';

const SEED_PROVIDER = 'seed-dictionary';

export type ProductSourceFields = {
  title: string;
  description: string | null;
  variety: string | null;
  originPlace: string | null;
};

export type PurchaseRequestSourceFields = {
  title: string;
  variety: string | null;
  packaging: string | null;
  destinationCountry: string | null;
  message: string | null;
};

export function catalogSourceHash(parts: readonly (string | null | undefined)[]): string {
  const payload = parts.map((part) => (part ?? '').normalize('NFC').trim()).join('\u001f');
  return createHash('sha256').update(payload).digest('hex');
}

export function productSourceHash(fields: ProductSourceFields): string {
  return catalogSourceHash([fields.title, fields.description, fields.variety, fields.originPlace]);
}

export function purchaseRequestSourceHash(fields: PurchaseRequestSourceFields): string {
  return catalogSourceHash([
    fields.title,
    fields.variety,
    fields.packaging,
    fields.destinationCountry,
    fields.message,
  ]);
}

export type FarmSourceFields = {
  description: string | null;
  history: string | null;
  ownershipType: string | null;
  exportMarkets: string[];
};

export function farmSourceHash(fields: FarmSourceFields): string {
  return catalogSourceHash([
    fields.description,
    fields.history,
    fields.ownershipType,
    ...fields.exportMarkets,
  ]);
}

export function farmHasPublicCopy(fields: FarmSourceFields): boolean {
  return Boolean(
    fields.description?.trim() ||
      fields.history?.trim() ||
      fields.ownershipType?.trim() ||
      fields.exportMarkets.some((market) => market.trim()),
  );
}

export function sameCatalogSource(left: string | null | undefined, right: string): boolean {
  return left === right;
}

type FieldMap = Record<string, string | null>;

@Injectable()
export class CatalogTranslationService implements OnModuleInit {
  private readonly logger = new Logger(CatalogTranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    void this.backfill().catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Catalog translation backfill failed';
      this.logger.warn(message);
    });
  }

  /**
   * Seed-dictionary rows are written on startup without calling the provider.
   * Machine translation of existing rows runs only when a real provider is configured,
   * so a mock provider cannot mark junk translations as completed.
   */
  async backfill(): Promise<void> {
    await this.applySeedDictionary();
    if (this.translation.providerName === 'mock') {
      this.logger.log(
        'Catalog machine translation skipped: TRANSLATION_PROVIDER is mock. Seed-dictionary rows were applied.',
      );
      return;
    }
    await this.syncMissing();
  }

  async syncProduct(productId: string): Promise<void> {
    try {
      await this.syncProductNow(productId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Product translation failed';
      this.logger.warn(`Product ${productId}: ${message}`);
    }
  }

  async syncFarm(farmId: string): Promise<void> {
    try {
      await this.syncFarmNow(farmId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Farm translation failed';
      this.logger.warn(`Farm ${farmId}: ${message}`);
    }
  }

  async syncPurchaseRequest(requestId: string): Promise<void> {
    try {
      await this.syncPurchaseRequestNow(requestId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Purchase request translation failed';
      this.logger.warn(`Purchase request ${requestId}: ${message}`);
    }
  }

  private async syncMissing(): Promise<void> {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        sourceLocale: true,
        translations: { select: { locale: true, status: true } },
      },
    });
    for (const product of products) {
      const targets = CATALOG_LOCALES.filter((locale) => locale !== product.sourceLocale);
      const ready = new Set(
        product.translations
          .filter((row) => row.status === MessageTranslationStatus.completed)
          .map((row) => row.locale),
      );
      if (targets.some((locale) => !ready.has(locale))) {
        await this.syncProduct(product.id);
      }
    }

    const requests = await this.prisma.purchaseRequest.findMany({
      select: {
        id: true,
        sourceLocale: true,
        translations: { select: { locale: true, status: true } },
      },
    });
    for (const request of requests) {
      const targets = CATALOG_LOCALES.filter((locale) => locale !== request.sourceLocale);
      const ready = new Set(
        request.translations
          .filter((row) => row.status === MessageTranslationStatus.completed)
          .map((row) => row.locale),
      );
      if (targets.some((locale) => !ready.has(locale))) {
        await this.syncPurchaseRequest(request.id);
      }
    }

    const farms = await this.prisma.farm.findMany({
      select: {
        id: true,
        sourceLocale: true,
        description: true,
        history: true,
        ownershipType: true,
        exportMarkets: true,
        translations: { select: { locale: true, status: true } },
      },
    });
    for (const farm of farms) {
      if (
        !farmHasPublicCopy({
          description: farm.description,
          history: farm.history,
          ownershipType: farm.ownershipType,
          exportMarkets: farm.exportMarkets,
        })
      ) {
        continue;
      }
      const targets = CATALOG_LOCALES.filter((locale) => locale !== farm.sourceLocale);
      const ready = new Set(
        farm.translations
          .filter((row) => row.status === MessageTranslationStatus.completed)
          .map((row) => row.locale),
      );
      if (targets.some((locale) => !ready.has(locale))) {
        await this.syncFarm(farm.id);
      }
    }
  }

  private async applySeedDictionary(): Promise<void> {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        variety: true,
        originPlace: true,
        sourceLocale: true,
      },
    });
    for (const product of products) {
      if (!PRODUCT_TITLE_I18N[product.title]) {
        continue;
      }
      if (product.sourceLocale !== LocaleCode.en) {
        await this.prisma.product.update({
          where: { id: product.id },
          data: { sourceLocale: LocaleCode.en },
        });
      }
      await this.writeSeedProduct(product);
    }
  }

  private async syncProductNow(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        translations: true,
        owner: { select: { locale: true } },
      },
    });
    if (!product) {
      return;
    }

    const fields: ProductSourceFields = {
      title: product.title,
      description: product.description,
      variety: product.variety,
      originPlace: product.originPlace,
    };
    const sourceLocale = product.sourceLocale
      ? product.sourceLocale
      : detectCatalogSourceLocale(
          [fields.title, fields.description, fields.variety, fields.originPlace]
            .filter(Boolean)
            .join('\n'),
          product.owner.locale,
        );
    if (!product.sourceLocale) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: { sourceLocale: sourceLocale },
      });
    }

    if (PRODUCT_TITLE_I18N[product.title] && sourceLocale === 'en') {
      await this.writeSeedProduct(product);
      return;
    }

    await this.translateProductLocales(
      product.id,
      sourceLocale,
      productSourceHash(fields),
      fields,
      product.translations,
    );
  }

  private async writeSeedProduct(product: {
    id: string;
    title: string;
    description: string | null;
    variety: string | null;
    originPlace: string | null;
  }): Promise<void> {
    const titles = PRODUCT_TITLE_I18N[product.title];
    if (!titles) {
      return;
    }
    const descriptions = product.description
      ? PRODUCT_DESCRIPTION_I18N[product.description]
      : undefined;
    const hash = productSourceHash(product);
    for (const locale of CATALOG_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      const title = titles[locale];
      if (!title) {
        continue;
      }
      await this.prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: locale } },
        create: {
          productId: product.id,
          locale: locale,
          title,
          description: descriptions?.[locale] ?? null,
          variety: null,
          originPlace: null,
          status: MessageTranslationStatus.completed,
          provider: SEED_PROVIDER,
          error: null,
          sourceHash: hash,
        },
        update: {
          title,
          description: descriptions?.[locale] ?? null,
          variety: null,
          status: MessageTranslationStatus.completed,
          provider: SEED_PROVIDER,
          error: null,
          sourceHash: hash,
        },
      });
    }
  }

  private async syncPurchaseRequestNow(requestId: string): Promise<void> {
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        translations: true,
        buyer: { select: { locale: true } },
      },
    });
    if (!request) {
      return;
    }
    const fields: PurchaseRequestSourceFields = {
      title: request.title,
      variety: request.variety,
      packaging: request.packaging,
      destinationCountry: request.destinationCountry,
      message: request.message,
    };
    await this.translatePurchaseRequestLocales(
      request.id,
      request.sourceLocale || 'en',
      purchaseRequestSourceHash(fields),
      fields,
      request.translations,
    );
  }

  private async translateProductLocales(
    productId: string,
    sourceLocale: Locale,
    hash: string,
    fields: ProductSourceFields,
    existing: { locale: LocaleCode; status: MessageTranslationStatus; sourceHash: string | null }[],
  ): Promise<void> {
    for (const locale of CATALOG_LOCALES) {
      if (locale === sourceLocale) {
        continue;
      }
      const current = existing.find((row) => row.locale === locale);
      if (
        current?.status === MessageTranslationStatus.completed &&
        sameCatalogSource(current.sourceHash, hash)
      ) {
        continue;
      }
      const localeCode = locale;
      const where = { productId_locale: { productId, locale: localeCode } };
      await this.prisma.productTranslation.upsert({
        where,
        create: {
          productId,
          locale: localeCode,
          status: MessageTranslationStatus.pending,
          provider: this.translation.providerName,
          error: null,
          sourceHash: hash,
        },
        update: {
          status: MessageTranslationStatus.pending,
          provider: this.translation.providerName,
          error: null,
          sourceHash: hash,
        },
      });
      try {
        const translated = await this.translateFields(sourceLocale, locale, fields);
        await this.prisma.productTranslation.update({
          where,
          data: {
            title: translated.title ?? null,
            description: translated.description ?? null,
            variety: null,
            originPlace: translated.originPlace ?? null,
            status: MessageTranslationStatus.completed,
            provider: this.translation.providerName,
            error: null,
            sourceHash: hash,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Translation failed';
        this.logger.warn(`Translation to ${locale} failed: ${message}`);
        await this.prisma.productTranslation.update({
          where,
          data: {
            status: MessageTranslationStatus.failed,
            error: message,
            sourceHash: hash,
          },
        });
      }
    }
  }

  private async translatePurchaseRequestLocales(
    requestId: string,
    sourceLocale: Locale,
    hash: string,
    fields: PurchaseRequestSourceFields,
    existing: { locale: LocaleCode; status: MessageTranslationStatus; sourceHash: string | null }[],
  ): Promise<void> {
    for (const locale of CATALOG_LOCALES) {
      if (locale === sourceLocale) {
        continue;
      }
      const current = existing.find((row) => row.locale === locale);
      if (
        current?.status === MessageTranslationStatus.completed &&
        sameCatalogSource(current.sourceHash, hash)
      ) {
        continue;
      }
      const localeCode = locale;
      const where = { requestId_locale: { requestId, locale: localeCode } };
      await this.prisma.purchaseRequestTranslation.upsert({
        where,
        create: {
          requestId,
          locale: localeCode,
          status: MessageTranslationStatus.pending,
          provider: this.translation.providerName,
          error: null,
          sourceHash: hash,
        },
        update: {
          status: MessageTranslationStatus.pending,
          provider: this.translation.providerName,
          error: null,
          sourceHash: hash,
        },
      });
      try {
        const translated = await this.translateFields(sourceLocale, locale, fields);
        await this.prisma.purchaseRequestTranslation.update({
          where,
          data: {
            title: translated.title ?? null,
            variety: null,
            packaging: translated.packaging ?? null,
            destinationCountry: translated.destinationCountry ?? null,
            message: translated.message ?? null,
            status: MessageTranslationStatus.completed,
            provider: this.translation.providerName,
            error: null,
            sourceHash: hash,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Translation failed';
        this.logger.warn(`Translation to ${locale} failed: ${message}`);
        await this.prisma.purchaseRequestTranslation.update({
          where,
          data: {
            status: MessageTranslationStatus.failed,
            error: message,
            sourceHash: hash,
          },
        });
      }
    }
  }

  private async syncFarmNow(farmId: string): Promise<void> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        translations: true,
        owner: { select: { locale: true } },
      },
    });
    if (!farm) {
      return;
    }
    const fields: FarmSourceFields = {
      description: farm.description,
      history: farm.history,
      ownershipType: farm.ownershipType,
      exportMarkets: farm.exportMarkets,
    };
    const sourceLocale = detectCatalogSourceLocale(
      [fields.description, fields.history, fields.ownershipType, ...fields.exportMarkets]
        .filter(Boolean)
        .join('\n'),
      farm.owner.locale,
    );
    if (farm.sourceLocale !== sourceLocale) {
      await this.prisma.farm.update({
        where: { id: farm.id },
        data: { sourceLocale },
      });
    }
    if (!farmHasPublicCopy(fields)) {
      return;
    }
    await this.translateFarmLocales(
      farm.id,
      sourceLocale,
      farmSourceHash(fields),
      fields,
      farm.translations,
    );
  }

  private async translateFarmLocales(
    farmId: string,
    sourceLocale: Locale,
    hash: string,
    fields: FarmSourceFields,
    existing: { locale: LocaleCode; status: MessageTranslationStatus; sourceHash: string | null }[],
  ): Promise<void> {
    for (const locale of CATALOG_LOCALES) {
      if (locale === sourceLocale) {
        continue;
      }
      const current = existing.find((row) => row.locale === locale);
      if (
        current?.status === MessageTranslationStatus.completed &&
        sameCatalogSource(current.sourceHash, hash)
      ) {
        continue;
      }
      const where = { farmId_locale: { farmId, locale } };
      await this.prisma.farmTranslation.upsert({
        where,
        create: {
          farmId,
          locale,
          status: MessageTranslationStatus.pending,
          provider: this.translation.providerName,
          error: null,
          sourceHash: hash,
          exportMarkets: [],
        },
        update: {
          status: MessageTranslationStatus.pending,
          provider: this.translation.providerName,
          error: null,
          sourceHash: hash,
        },
      });
      try {
        const description = await this.translateOptional(sourceLocale, locale, fields.description);
        const history = await this.translateOptional(sourceLocale, locale, fields.history);
        const exportMarkets: string[] = [];
        for (const market of fields.exportMarkets) {
          const translated = await this.translateOptional(sourceLocale, locale, market);
          if (translated) {
            exportMarkets.push(translated);
          }
        }
        await this.prisma.farmTranslation.update({
          where,
          data: {
            description,
            history,
            ownershipType: null,
            exportMarkets,
            status: MessageTranslationStatus.completed,
            provider: this.translation.providerName,
            error: null,
            sourceHash: hash,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Translation failed';
        this.logger.warn(`Translation to ${locale} failed: ${message}`);
        await this.prisma.farmTranslation.update({
          where,
          data: {
            status: MessageTranslationStatus.failed,
            error: message,
            sourceHash: hash,
          },
        });
      }
    }
  }

  private async translateOptional(
    sourceLocale: Locale,
    targetLocale: Locale,
    value: string | null,
  ): Promise<string | null> {
    if (!value?.trim()) {
      return null;
    }
    const result = await this.translation.translateText({
      text: value,
      sourceLocale,
      targetLocale,
    });
    return result.translatedText;
  }

  private async translateFields(
    sourceLocale: Locale,
    targetLocale: Locale,
    fields: ProductSourceFields | PurchaseRequestSourceFields,
  ): Promise<FieldMap> {
    const translated: FieldMap = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'variety' || !value?.trim()) {
        translated[key] = null;
        continue;
      }
      const result = await this.translation.translateText({
        text: value,
        sourceLocale,
        targetLocale,
      });
      translated[key] = result.translatedText;
    }
    return translated;
  }
}
