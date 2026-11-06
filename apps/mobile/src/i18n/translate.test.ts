import { en, type MessageKey } from './en';
import { ru } from './ru';
import { APP_LOCALES, localeFromLanguageCode } from './locales';
import { translate } from './translate';

describe('translate', () => {
  it('returns the English baseline', () => {
    expect(translate('en', 'home.searchPlaceholder')).toBe('Search products, farms...');
  });

  it('uses Russian trade terminology', () => {
    expect(translate('ru', 'home.opportunities')).toBe('Запросы на покупку');
    expect(translate('ru', 'messages.emptyBody')).toContain('предложениям');
    expect(translate('ru', 'home.platform')).toContain('платформа');
  });

  it('falls back to English for locales without a dictionary', () => {
    expect(translate('de', 'tabs.home')).toBe(en['tabs.home']);
    expect(translate('ka', 'tabs.requests')).toBe('Requests');
    expect(translate('fr', 'home.searchPlaceholder')).toBe(en['home.searchPlaceholder']);
    expect(translate('it', 'tabs.account')).toBe(en['tabs.account']);
    expect(translate('es', 'tabs.messages')).toBe(en['tabs.messages']);
  });

  it('translates every new farm-screen string in all seven locales', () => {
    const farmKeys = (Object.keys(en) as MessageKey[]).filter((key) => key.startsWith('farm.'));
    expect(farmKeys.length).toBeGreaterThan(0);
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of farmKeys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
    expect(translate('ru', 'farm.about')).toBe(ru['farm.about']);
  });

  it('translates email confirmation in every locale', () => {
    const keys = [
      'auth.confirmEmail',
      'auth.verifyTitle',
      'auth.verifyBody',
      'auth.verifyCode',
      'auth.verifyConfirm',
      'auth.verifyResend',
      'auth.verifyConfirmed',
      'account.emailNotVerified',
      'account.confirmEmail',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
  });

  it('translates password visibility labels in every locale', () => {
    const keys = [
      'auth.showPassword',
      'auth.hidePassword',
      'auth.showConfirmPassword',
      'auth.hideConfirmPassword',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
  });

  it('translates the conversation list in every locale', () => {
    const keys = [
      'messages.loading',
      'messages.loadErrorTitle',
      'messages.emptyBody',
      'messages.unknownPeer',
      'messages.unread',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
  });

  it('translates the conversation thread in every locale', () => {
    const keys = [
      'messages.threadLoading',
      'messages.threadLoadErrorTitle',
      'messages.deliverySent',
      'messages.deliveryRead',
      'messages.showOriginal',
      'messages.dateToday',
      'messages.dateYesterday',
      'messages.composerPlaceholder',
      'messages.send',
      'messages.sending',
      'messages.composerEmpty',
      'messages.composerTooLong',
      'messages.sendError',
      'a11y.openConversation',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
  });

  it('translates the notifications center in every locale', () => {
    const keys = [
      'notifications.loading',
      'notifications.loadErrorTitle',
      'notifications.emptyTitle',
      'notifications.markAllRead',
      'notifications.markReadError',
      'notifications.unread',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
  });

  it('translates my products in every locale', () => {
    const keys = [
      'account.sellingTitle',
      'account.myProducts',
      'account.farmProfile',
      'seller.farm.title',
      'seller.farm.empty',
      'seller.farm.emptyBody',
      'seller.farm.about',
      'seller.farm.details',
      'seller.farm.required',
      'seller.farm.keptValue',
      'seller.farm.marketsHint',
      'seller.farm.pendingBody',
      'seller.farm.approvedBody',
      'seller.farm.unverifiedBody',
      'seller.farm.rejectedBody',
      'seller.farm.created',
      'seller.farm.photos',
      'seller.farm.verification',
      'seller.farm.verificationUnavailable',
      'seller.farm.documents',
      'seller.farm.uploadId',
      'seller.products.title',
      'seller.products.emptyTitle',
      'seller.products.emptyBody',
      'seller.products.loading',
      'seller.products.loadErrorTitle',
      'seller.products.loadErrorBody',
      'seller.products.retry',
      'seller.products.status.draft',
      'seller.products.status.pending',
      'seller.products.status.published',
      'seller.products.status.rejected',
      'seller.products.filter.all',
      'seller.products.filter.published',
      'seller.products.filter.pending',
      'seller.products.preview',
      'seller.products.edit',
      'seller.products.views',
      'seller.products.subscribers',
      'seller.products.updateAvailability',
      'seller.products.updateAvailabilityPending',
      'seller.products.updateAvailabilityFailed',
      'seller.draft.create',
      'seller.draft.productTitle',
      'seller.draft.description',
      'seller.draft.save',
      'seller.draft.saving',
      'seller.draft.titleRequired',
      'seller.draft.titleTooShort',
      'seller.draft.titleTooLong',
      'seller.draft.descriptionTooLong',
      'seller.draft.failed',
      'seller.draft.rateLimited',
      'seller.draft.category',
      'seller.draft.unit',
      'seller.draft.price',
      'seller.draft.currency',
      'seller.draft.priceNegotiable',
      'seller.draft.priceDependsOnVolume',
      'seller.draft.notSelected',
      'seller.draft.priceInvalid',
      'seller.draft.variety',
      'seller.draft.country',
      'seller.draft.originPlace',
      'seller.draft.originPlacePlaceholder',
      'seller.draft.varietyTooLong',
      'seller.draft.countryTooLong',
      'seller.draft.originPlaceTooLong',
      'seller.draft.quantitySection',
      'seller.draft.currentStock',
      'seller.draft.monthlyProduction',
      'seller.draft.maxAnnualProduction',
      'seller.draft.minQuantity',
      'seller.draft.maxQuantity',
      'seller.draft.quantityHint',
      'seller.draft.quantityInvalid',
      'seller.draft.quantityRangeInvalid',
      'seller.draft.harvestSection',
      'seller.draft.harvestSubtitle',
      'seller.draft.seasonMonths',
      'seller.draft.selectAllMonths',
      'seller.draft.clearMonths',
      'seller.draft.harvestStart',
      'seller.draft.harvestEnd',
      'seller.draft.chooseDate',
      'seller.draft.clearDate',
      'seller.draft.previousMonth',
      'seller.draft.nextMonth',
      'seller.draft.done',
      'seller.draft.forecastQuantity',
      'seller.draft.forecastPlaceholder',
      'seller.draft.forecastUnitHint',
      'seller.draft.noUnit',
      'seller.draft.forecastInvalid',
      'seller.draft.harvestStatus',
      'seller.draft.harvestStatusUnset',
      'seller.draft.harvestStatus.growing',
      'seller.draft.harvestStatus.available',
      'seller.draft.harvestStatus.limited',
      'seller.draft.harvestStatus.soldOut',
      'seller.draft.harvestStatusInvalid',
      'seller.draft.preorderEnabled',
      'seller.draft.harvestDateInvalid',
      'seller.draft.harvestDateOrder',
      'seller.draft.seasonMonthsInvalid',
      'seller.draft.month.1',
      'seller.draft.month.2',
      'seller.draft.month.3',
      'seller.draft.month.4',
      'seller.draft.month.5',
      'seller.draft.month.6',
      'seller.draft.month.7',
      'seller.draft.month.8',
      'seller.draft.month.9',
      'seller.draft.month.10',
      'seller.draft.month.11',
      'seller.draft.month.12',
      'seller.draft.packagingSection',
      'seller.draft.packagingTypes',
      'seller.draft.packaging.woodenBox',
      'seller.draft.packaging.plasticCrate',
      'seller.draft.packaging.bag',
      'seller.draft.packaging.bulk',
      'seller.draft.packaging.other',
      'seller.draft.packagingWeights',
      'seller.draft.packagingWeightsPlaceholder',
      'seller.draft.palletSize',
      'seller.draft.logisticsSection',
      'seller.draft.deliveryAvailable',
      'seller.draft.carriers',
      'seller.draft.carrierOther',
      'seller.draft.customDelivery',
      'seller.draft.nearestPort',
      'seller.draft.leadTimeDays',
      'seller.draft.packagingTypesInvalid',
      'seller.draft.packagingWeightsInvalid',
      'seller.draft.palletTooLong',
      'seller.draft.incotermsInvalid',
      'seller.draft.carriersInvalid',
      'seller.draft.customDeliveryTooLong',
      'seller.draft.nearestPortTooLong',
      'seller.draft.leadTimeInvalid',
      'seller.photos.title',
      'seller.photos.subtitle',
      'seller.photos.saveFirst',
      'seller.photos.add',
      'seller.photos.uploading',
      'seller.photos.empty',
      'seller.photos.primary',
      'seller.photos.setPrimary',
      'seller.photos.remove',
      'seller.photos.deleteTitle',
      'seller.photos.deleteConfirm',
      'seller.photos.cancel',
      'seller.photos.maxReached',
      'seller.photos.unsupported',
      'seller.photos.tooLarge',
      'seller.photos.uploadFailed',
      'seller.photos.deleteFailed',
      'seller.photos.primaryFailed',
      'seller.photos.retry',
      'seller.photos.lastPublished',
      'seller.photos.permission',
      'seller.photos.pickerFailed',
      'categories.tea',
      'categories.vegetables',
      'units.kg',
      'units.bottle',
      'seller.edit.title',
      'seller.editor.details',
      'seller.editor.offer',
      'seller.edit.save',
      'seller.edit.saving',
      'seller.edit.loading',
      'seller.edit.notFoundTitle',
      'seller.edit.notFoundBody',
      'seller.edit.loadErrorTitle',
      'seller.edit.loadErrorBody',
      'seller.edit.failed',
      'seller.edit.forbidden',
      'seller.edit.rejectionNote',
      'seller.edit.publishedIncomplete',
      'seller.publish.action',
      'seller.publish.resubmit',
      'seller.publish.publishing',
      'seller.publish.hint',
      'seller.publish.pending',
      'seller.publish.live',
      'seller.publish.sent',
      'seller.publish.failed',
      'seller.publish.unauthorized',
      'seller.publish.forbidden',
      'seller.publish.notFound',
      'seller.publish.network',
      'seller.publish.title',
      'seller.publish.category',
      'seller.publish.unit',
      'seller.publish.price',
      'seller.publish.currency',
      'seller.publish.photo',
      'seller.delete.action',
      'seller.delete.confirm',
      'seller.delete.cancel',
      'seller.delete.title',
      'seller.delete.body',
      'seller.delete.pending',
      'seller.delete.success',
      'seller.delete.failed',
      'seller.delete.unauthorized',
      'seller.delete.forbidden',
      'seller.delete.notFound',
      'seller.delete.conflict',
      'seller.delete.network',
      'seller.video.title',
      'seller.video.add',
      'seller.video.replace',
      'seller.video.delete',
      'seller.video.deleteConfirm',
      'seller.video.uploaded',
      'seller.video.deleted',
      'seller.video.unsupported',
      'seller.video.tooLarge',
      'seller.video.uploadFailed',
      'seller.video.deleteFailed',
      'seller.certificates.title',
      'seller.certificates.type',
      'seller.certificates.titleField',
      'seller.certificates.selectFile',
      'seller.certificates.upload',
      'seller.certificates.open',
      'seller.certificates.delete',
      'seller.certificates.deleteConfirm',
      'seller.certificates.uploaded',
      'seller.certificates.deleted',
      'seller.certificates.uploadFailed',
      'seller.certificates.deleteFailed',
      'seller.certificates.unsupported',
      'seller.certificates.tooLarge',
      'seller.certificates.maxReached',
      'seller.certificates.note',
      'seller.certificates.status.pending',
      'seller.certificates.status.approved',
      'seller.certificates.status.rejected',
      'seller.certificates.type.organic',
      'seller.certificates.type.other',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
  });

  it('translates catalog, request, and account actions', () => {
    const keys = [
      'home.viewAll',
      'home.productCatalog',
      'catalog.title',
      'catalog.emptyTitle',
      'requests.mine',
      'requests.create',
      'account.danger',
      'account.delete',
      'account.deleteConfirmBody',
      'account.changePassword',
      'account.passwordChanged',
      'requests.myQuotes',
      'requests.messageBuyer',
      'rfq.screenTitle',
      'rfq.inboxTitle',
      'rfq.inboxEmptyTitle',
      'rfq.inboxEmptyBody',
      'rfq.mineTitle',
      'rfq.mineEmptyTitle',
      'rfq.mineEmptyBody',
      'rfq.browseCatalog',
      'rfq.loading',
      'rfq.loadErrorTitle',
      'rfq.loadErrorBody',
      'rfq.inboxLoadErrorTitle',
      'rfq.inboxLoadErrorBody',
      'rfq.retry',
      'rfq.notFoundTitle',
      'rfq.notFoundBody',
      'rfq.forbiddenTitle',
      'rfq.forbiddenBody',
      'rfq.status.pending',
      'rfq.status.offered',
      'rfq.status.accepted',
      'rfq.status.completed',
      'rfq.status.declined',
      'rfq.status.cancelled',
      'rfq.quantity',
      'rfq.buyer',
      'rfq.seller',
      'rfq.buyerFallback',
      'rfq.sellerFallback',
      'rfq.farm',
      'rfq.message',
      'rfq.offer',
      'rfq.offerPrice',
      'rfq.offerCurrency',
      'rfq.offerMessage',
      'rfq.validUntil',
      'rfq.makeOffer',
      'rfq.sendOffer',
      'rfq.accept',
      'rfq.decline',
      'rfq.complete',
      'rfq.cancel',
      'rfq.delete',
      'rfq.messageParty',
      'rfq.offerInvalid',
      'rfq.confirm.accept',
      'rfq.confirm.decline',
      'rfq.confirm.complete',
      'rfq.confirm.cancel',
      'rfq.confirm.delete',
      'errors.incorrectPassword',
      'errors.invalidCode',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') continue;
      for (const key of keys) {
        expect(translate(locale, key).trim().length).toBeGreaterThan(0);
        expect(translate(locale, key)).not.toBe(en[key]);
      }
    }
  });

  it('translates the cabinet and filter sheet', () => {
    const keys = [
      'account.profile',
      'account.purchases',
      'account.edit',
      'catalog.showResults',
      'catalog.reset',
      'catalog.chooseOne',
      'catalog.chooseAny',
      'catalog.regionsSelected',
      'catalog.yes',
    ] as const;
    for (const locale of APP_LOCALES) {
      if (locale === 'en') continue;
      for (const key of keys) {
        expect(translate(locale, key).trim().length).toBeGreaterThan(0);
        expect(translate(locale, key)).not.toBe(en[key]);
      }
      expect(translate(locale, 'account.name').trim().length).toBeGreaterThan(0);
    }
    expect(translate('de', 'account.name')).toBe('Name');
    expect(translate('ru', 'account.name')).toBe('Имя');
    expect(translate('ka', 'account.name')).toBe('სახელი');
  });

  it('interpolates parameters', () => {
    expect(translate('en', 'a11y.selectCategory', { category: 'Wine' })).toBe('Show Wine');
  });

  it('keeps Russian copy free of quotation and RFQ wording', () => {
    const text = Object.values(ru).join('\n');
    expect(text.toLowerCase()).not.toContain('котиров');
    expect(text).not.toMatch(/\bRFQ\b/);
  });
});

describe('localeFromLanguageCode', () => {
  it('accepts every AgroBridge locale and falls back otherwise', () => {
    expect(localeFromLanguageCode('ka')).toBe('ka');
    expect(localeFromLanguageCode('ru-RU')).toBe('ru');
    expect(localeFromLanguageCode('de')).toBe('de');
    expect(localeFromLanguageCode('pt')).toBe('en');
    expect(localeFromLanguageCode(null)).toBe('en');
  });
});
