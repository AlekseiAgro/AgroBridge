'use client';

import {
  CARRIERS,
  HARVEST_STATUSES,
  INCOTERMS,
  PACKAGING_TYPES,
  PRICE_CURRENCIES,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  SEASON_MONTHS,
  attributeFieldsForCategory,
  computeProductQualityScore,
  defaultUnitForCategory,
  type Carrier,
  type HarvestStatus,
  type Incoterm,
  type PackagingType,
  type ProductDetail,
  type ProductUnit,
  type SeasonMonth,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useMemo, useState } from 'react';
import { ProductQualityWidget } from '@/components/ProductQualityWidget';
import { useRouter } from '@/i18n/navigation';

type Props = {
  mode: 'create' | 'edit';
  initial?: ProductDetail | null;
};

function parseOptionalQuantity(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function numberString(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function commaValues(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ProductForm({ mode, initial }: Props) {
  const t = useTranslations('product');
  const th = useTranslations('harvest');
  const tc = useTranslations('catalog');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [variety, setVariety] = useState(initial?.variety ?? '');
  const [country, setCountry] = useState(initial?.country ?? 'Georgia');
  const [originPlace, setOriginPlace] = useState(initial?.originPlace ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [unitTouched, setUnitTouched] = useState(Boolean(initial?.unit));
  const [currentStock, setCurrentStock] = useState(numberString(initial?.currentStock));
  const [monthlyProduction, setMonthlyProduction] = useState(
    numberString(initial?.monthlyProduction),
  );
  const [maxAnnualProduction, setMaxAnnualProduction] = useState(
    numberString(initial?.maxAnnualProduction),
  );
  const [minQuantity, setMinQuantity] = useState(numberString(initial?.minQuantity));
  const [maxQuantity, setMaxQuantity] = useState(numberString(initial?.maxQuantity));
  const [attributes, setAttributes] = useState<Record<string, unknown>>(initial?.attributes ?? {});
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>(
    initial?.packagingTypes ?? [],
  );
  const [packagingWeightsText, setPackagingWeightsText] = useState(
    (initial?.packagingWeights ?? []).join(', '),
  );
  const [palletSize, setPalletSize] = useState(initial?.palletSize ?? '');
  const [incoterms, setIncoterms] = useState<Incoterm[]>(initial?.incoterms ?? []);
  const [carriers, setCarriers] = useState<Carrier[]>(initial?.carriers ?? []);
  const [customDelivery, setCustomDelivery] = useState(initial?.customDelivery ?? '');
  const [nearestPort, setNearestPort] = useState(initial?.nearestPort ?? '');
  const [deliveryAvailable, setDeliveryAvailable] = useState(initial?.deliveryAvailable ?? false);
  const [leadTimeDays, setLeadTimeDays] = useState(numberString(initial?.leadTimeDays));
  const [priceFrom, setPriceFrom] = useState(numberString(initial?.priceFrom));
  const [priceCurrency, setPriceCurrency] = useState(initial?.priceCurrency ?? 'EUR');
  const [priceNegotiable, setPriceNegotiable] = useState(initial?.priceNegotiable ?? false);
  const [priceDependsOnVolume, setPriceDependsOnVolume] = useState(
    initial?.priceDependsOnVolume ?? false,
  );
  const [seasonMonths, setSeasonMonths] = useState<SeasonMonth[]>(
    (initial?.seasonMonths ?? []) as SeasonMonth[],
  );
  const [harvestStartAt, setHarvestStartAt] = useState(toDateInput(initial?.harvestStartAt));
  const [harvestEndAt, setHarvestEndAt] = useState(toDateInput(initial?.harvestEndAt));
  const [harvestStatus, setHarvestStatus] = useState<HarvestStatus | ''>(
    initial?.harvestStatus ?? '',
  );
  const [preorderEnabled, setPreorderEnabled] = useState(initial?.preorderEnabled ?? false);

  const suggestedUnit = useMemo(() => defaultUnitForCategory(category) ?? '', [category]);
  const attributeFields = useMemo(() => attributeFieldsForCategory(category), [category]);
  const packagingWeights = useMemo(() => commaValues(packagingWeightsText), [packagingWeightsText]);
  const qualityScore = useMemo(
    () =>
      computeProductQualityScore({
        title,
        category,
        variety,
        country,
        region: initial?.farm.region,
        originPlace,
        description,
        imageCount: initial?.images.length ?? 0,
        imageKinds: initial?.images.map((image) => image.kind) ?? [],
        videoCount: initial?.videos.length ?? 0,
        hasSeasonality: seasonMonths.length > 0 || Boolean(harvestStartAt) || Boolean(harvestEndAt),
        currentStock: numberOrNull(currentStock),
        monthlyProduction: numberOrNull(monthlyProduction),
        maxAnnualProduction: numberOrNull(maxAnnualProduction),
        minQuantity: numberOrNull(minQuantity),
        maxQuantity: numberOrNull(maxQuantity),
        attributes,
        packagingTypes,
        packagingWeights,
        certificateCount: initial?.certificates.length ?? 0,
        approvedCertificateCount:
          initial?.certificates.filter((certificate) => certificate.reviewStatus === 'approved')
            .length ?? 0,
        incoterms,
        carriers,
        nearestPort,
        leadTimeDays: numberOrNull(leadTimeDays),
        priceFrom: numberOrNull(priceFrom),
        priceNegotiable,
        priceDependsOnVolume,
        farmFoundedYear: initial?.farm.foundedYear,
        farmSizeHectares: initial?.farm.farmSizeHectares,
        farmHistory: initial?.farm.history,
        farmExportMarkets: initial?.farm.exportMarkets,
      }),
    [
      attributes,
      carriers,
      category,
      country,
      currentStock,
      description,
      incoterms,
      initial,
      harvestEndAt,
      harvestStartAt,
      leadTimeDays,
      maxAnnualProduction,
      maxQuantity,
      minQuantity,
      monthlyProduction,
      nearestPort,
      originPlace,
      packagingTypes,
      packagingWeights,
      priceDependsOnVolume,
      priceFrom,
      priceNegotiable,
      seasonMonths,
      title,
      variety,
    ],
  );

  function toggleMonth(month: SeasonMonth) {
    setSeasonMonths((prev) =>
      prev.includes(month)
        ? prev.filter((item) => item !== month)
        : [...prev, month].sort((a, b) => a - b),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const parsedMinQuantity = parseOptionalQuantity(form.get('minQuantity'));
    const parsedMaxQuantity = parseOptionalQuantity(form.get('maxQuantity'));
    const parsedCurrentStock = parseOptionalQuantity(form.get('currentStock'));
    const parsedMonthlyProduction = parseOptionalQuantity(form.get('monthlyProduction'));
    const parsedMaxAnnualProduction = parseOptionalQuantity(form.get('maxAnnualProduction'));
    const forecastQuantity = parseOptionalQuantity(form.get('forecastQuantity'));
    const parsedLeadTimeDays = parseOptionalQuantity(form.get('leadTimeDays'));
    const parsedPriceFrom = parseOptionalQuantity(form.get('priceFrom'));
    if (
      [
        parsedMinQuantity,
        parsedMaxQuantity,
        parsedCurrentStock,
        parsedMonthlyProduction,
        parsedMaxAnnualProduction,
        forecastQuantity,
        parsedLeadTimeDays,
        parsedPriceFrom,
      ].some(Number.isNaN)
    ) {
      setError(t('quantityInvalid'));
      setPending(false);
      return;
    }
    if (
      parsedMinQuantity != null &&
      parsedMaxQuantity != null &&
      parsedMinQuantity > parsedMaxQuantity
    ) {
      setError(t('quantityRangeInvalid'));
      setPending(false);
      return;
    }

    const parsedHarvestStartAt = String(form.get('harvestStartAt') ?? '').trim() || null;
    const parsedHarvestEndAt = String(form.get('harvestEndAt') ?? '').trim() || null;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category || undefined,
      variety: variety.trim(),
      country: country.trim(),
      originPlace: originPlace.trim(),
      unit: unit || undefined,
      currentStock: parsedCurrentStock,
      monthlyProduction: parsedMonthlyProduction,
      maxAnnualProduction: parsedMaxAnnualProduction,
      minQuantity: parsedMinQuantity,
      maxQuantity: parsedMaxQuantity,
      attributes: Object.fromEntries(
        attributeFields
          .map((field) => [field.key, attributes[field.key]] as const)
          .filter(([, value]) => value !== undefined && value !== ''),
      ),
      packagingTypes,
      packagingWeights,
      palletSize: palletSize.trim(),
      incoterms,
      carriers,
      customDelivery: customDelivery.trim(),
      nearestPort: nearestPort.trim(),
      deliveryAvailable,
      leadTimeDays: parsedLeadTimeDays,
      priceFrom: parsedPriceFrom,
      priceCurrency,
      priceNegotiable,
      priceDependsOnVolume,
      seasonMonths,
      harvestStartAt: parsedHarvestStartAt,
      harvestEndAt: parsedHarvestEndAt,
      forecastQuantity,
      harvestStatus: harvestStatus || null,
      preorderEnabled,
      isPublished: form.get('isPublished') === 'on',
    };

    try {
      const response = await fetch(
        mode === 'create' ? '/api/products' : `/api/products/${initial?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { message?: string; id?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      if (mode === 'create' && data.id) {
        router.replace(`/dashboard/products/${data.id}/edit`);
      } else {
        router.replace('/dashboard/products');
      }
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form product-form" onSubmit={onSubmit}>
      <ProductQualityWidget score={qualityScore} />

      <fieldset className="field-group product-form__section">
        <legend className="section-title">{t('sections.basics')}</legend>
        <div className="field-row">
          <label className="field">
            <span>{t('title')}</span>
            <input
              name="title"
              required
              minLength={2}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('category')}</span>
            <select
              name="category"
              value={category}
              onChange={(event) => {
                const nextCategory = event.target.value;
                setCategory(nextCategory);
                if (!unitTouched) setUnit(defaultUnitForCategory(nextCategory) ?? '');
              }}
            >
              <option value="">{tc('allCategories')}</option>
              {PRODUCT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {tc(`categories.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('variety')}</span>
            <input value={variety} onChange={(event) => setVariety(event.target.value)} />
          </label>
          <label className="field">
            <span>{t('unit')}</span>
            <select
              name="unit"
              value={unit}
              onChange={(event) => {
                setUnitTouched(true);
                setUnit(event.target.value);
              }}
            >
              <option value="">{t('noUnit')}</option>
              {PRODUCT_UNITS.map((value) => (
                <option key={value} value={value}>
                  {t(`units.${value}`)}
                  {suggestedUnit === value ? ` (${t('unitSuggested')})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('country')}</span>
            <input value={country} onChange={(event) => setCountry(event.target.value)} />
          </label>
          <label className="field">
            <span>{t('originPlace')}</span>
            <input
              value={originPlace}
              onChange={(event) => setOriginPlace(event.target.value)}
              placeholder={t('originPlacePlaceholder')}
            />
          </label>
        </div>
        <label className="field">
          <span>{t('description')}</span>
          <textarea
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="field-group product-form__section">
        <legend className="section-title">{t('sections.volume')}</legend>
        <div className="field-row">
          {[
            ['currentStock', currentStock, setCurrentStock],
            ['monthlyProduction', monthlyProduction, setMonthlyProduction],
            ['maxAnnualProduction', maxAnnualProduction, setMaxAnnualProduction],
            ['minQuantity', minQuantity, setMinQuantity],
            ['maxQuantity', maxQuantity, setMaxQuantity],
          ].map(([name, value, setter]) => (
            <label className="field" key={String(name)}>
              <span>{t(String(name))}</span>
              <input
                name={String(name)}
                type="number"
                min={0.01}
                step="0.01"
                inputMode="decimal"
                value={String(value)}
                onChange={(event) => (setter as (next: string) => void)(event.target.value)}
              />
            </label>
          ))}
        </div>
        <p className="field-hint">
          {t('quantityHint', {
            unit: unit
              ? t(`units.${unit as ProductUnit}`)
              : suggestedUnit
                ? t(`units.${suggestedUnit as ProductUnit}`)
                : t('noUnit'),
          })}
        </p>
      </fieldset>

      <fieldset className="field-group product-form__section">
        <legend className="section-title">{t('sections.attributes')}</legend>
        <p className="page__subtitle">{t('attributesHint')}</p>
        <div className="field-row">
          {attributeFields.map((field) => (
            <label className="field" key={field.key}>
              <span>{t(`attributes.${field.key}`)}</span>
              {field.type === 'boolean' ? (
                <select
                  value={
                    typeof attributes[field.key] === 'boolean' ? String(attributes[field.key]) : ''
                  }
                  onChange={(event) =>
                    setAttributes((current) => ({
                      ...current,
                      [field.key]:
                        event.target.value === '' ? undefined : event.target.value === 'true',
                    }))
                  }
                >
                  <option value="">{t('notSpecified')}</option>
                  <option value="true">{t('yes')}</option>
                  <option value="false">{t('no')}</option>
                </select>
              ) : field.type === 'select' ? (
                <select
                  value={String(attributes[field.key] ?? '')}
                  onChange={(event) =>
                    setAttributes((current) => ({
                      ...current,
                      [field.key]: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">{t('notSpecified')}</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {t(`attributeOptions.${option}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  step={field.type === 'number' ? '0.01' : undefined}
                  value={String(attributes[field.key] ?? '')}
                  onChange={(event) =>
                    setAttributes((current) => ({
                      ...current,
                      [field.key]:
                        field.type === 'number'
                          ? event.target.value
                            ? Number(event.target.value)
                            : undefined
                          : event.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field-group product-form__section">
        <legend className="section-title">{t('sections.packaging')}</legend>
        <div className="chip-grid">
          {PACKAGING_TYPES.map((value) => (
            <label key={value} className="check-row check-row--chip">
              <input
                type="checkbox"
                checked={packagingTypes.includes(value)}
                onChange={() => setPackagingTypes((current) => toggleValue(current, value))}
              />
              <span>{t(`packagingTypes.${value}`)}</span>
            </label>
          ))}
        </div>
        <label className="field">
          <span>{t('packagingWeights')}</span>
          <input
            value={packagingWeightsText}
            onChange={(event) => setPackagingWeightsText(event.target.value)}
            placeholder={t('packagingWeightsPlaceholder')}
          />
        </label>
        <div className="product-form__quick-values">
          {['5 kg', '10 kg', '15 kg'].map((weight) => (
            <button
              key={weight}
              type="button"
              className="button button--ghost product-form__quick-button"
              onClick={() =>
                setPackagingWeightsText((current) =>
                  [...new Set([...commaValues(current), weight])].join(', '),
                )
              }
            >
              + {weight}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t('palletSize')}</span>
          <input value={palletSize} onChange={(event) => setPalletSize(event.target.value)} />
        </label>
      </fieldset>

      <fieldset className="field-group product-form__section">
        <legend className="section-title">{t('sections.logistics')}</legend>
        <div className="field">
          <span>{t('incoterms')}</span>
          <div className="chip-grid">
            {INCOTERMS.map((value) => (
              <label key={value} className="check-row check-row--chip">
                <input
                  type="checkbox"
                  checked={incoterms.includes(value)}
                  onChange={() => setIncoterms((current) => toggleValue(current, value))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('carriers')}</span>
          <div className="chip-grid">
            {CARRIERS.map((value) => (
              <label key={value} className="check-row check-row--chip">
                <input
                  type="checkbox"
                  checked={carriers.includes(value)}
                  onChange={() => setCarriers((current) => toggleValue(current, value))}
                />
                <span>{value === 'other' ? t('other') : value}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('nearestPort')}</span>
            <input value={nearestPort} onChange={(event) => setNearestPort(event.target.value)} />
          </label>
          <label className="field">
            <span>{t('leadTimeDays')}</span>
            <input
              name="leadTimeDays"
              type="number"
              min={0}
              max={365}
              step={1}
              value={leadTimeDays}
              onChange={(event) => setLeadTimeDays(event.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>{t('customDelivery')}</span>
          <textarea
            rows={3}
            value={customDelivery}
            onChange={(event) => setCustomDelivery(event.target.value)}
          />
        </label>
        <label className="role-option">
          <input
            type="checkbox"
            checked={deliveryAvailable}
            onChange={(event) => setDeliveryAvailable(event.target.checked)}
          />
          <span>{t('deliveryAvailable')}</span>
        </label>
      </fieldset>

      <fieldset className="field-group product-form__section">
        <legend className="section-title">{t('sections.pricing')}</legend>
        <div className="field-row">
          <label className="field">
            <span>{t('priceFrom')}</span>
            <input
              name="priceFrom"
              type="number"
              min={0}
              step="0.01"
              value={priceFrom}
              onChange={(event) => setPriceFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('priceCurrency')}</span>
            <select
              value={priceCurrency}
              onChange={(event) =>
                setPriceCurrency(event.target.value as (typeof PRICE_CURRENCIES)[number])
              }
            >
              {PRICE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="role-option">
          <input
            type="checkbox"
            checked={priceNegotiable}
            onChange={(event) => setPriceNegotiable(event.target.checked)}
          />
          <span>{t('priceNegotiable')}</span>
        </label>
        <label className="role-option">
          <input
            type="checkbox"
            checked={priceDependsOnVolume}
            onChange={(event) => setPriceDependsOnVolume(event.target.checked)}
          />
          <span>{t('priceDependsOnVolume')}</span>
        </label>
      </fieldset>

      <fieldset className="field-group harvest-form product-form__section">
        <legend className="section-title">{th('formTitle')}</legend>
        <p className="page__subtitle">{th('formSubtitle')}</p>

        <div className="field">
          <span>{th('seasonality')}</span>
          <div className="chip-grid">
            {SEASON_MONTHS.map((month) => (
              <label key={month} className="check-row check-row--chip">
                <input
                  type="checkbox"
                  checked={seasonMonths.includes(month)}
                  onChange={() => toggleMonth(month)}
                />
                <span>{th(`months.${month}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{th('startDate')}</span>
            <input
              name="harvestStartAt"
              type="date"
              value={harvestStartAt}
              onChange={(event) => setHarvestStartAt(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{th('endDate')}</span>
            <input
              name="harvestEndAt"
              type="date"
              value={harvestEndAt}
              onChange={(event) => setHarvestEndAt(event.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>{th('forecast')}</span>
          <input
            name="forecastQuantity"
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            placeholder={th('forecastPlaceholder')}
            defaultValue={initial?.forecastQuantity ?? ''}
          />
        </label>

        <label className="field">
          <span>{th('statusLabel')}</span>
          <select
            value={harvestStatus}
            onChange={(event) => setHarvestStatus(event.target.value as HarvestStatus | '')}
          >
            <option value="">{th('statusUnset')}</option>
            {HARVEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {th(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="role-option">
          <input
            type="checkbox"
            checked={preorderEnabled}
            onChange={(event) => setPreorderEnabled(event.target.checked)}
          />
          <span>{th('preorderEnable')}</span>
        </label>
      </fieldset>

      <label className="role-option">
        <input name="isPublished" type="checkbox" defaultChecked={initial?.isPublished ?? false} />
        <span>{t('submitForReview')}</span>
      </label>
      {initial?.moderationStatus ? (
        <p className="product-list__meta">
          {t('moderationLabel')}: {t(`moderation.${initial.moderationStatus}`)}
          {initial.moderationNote ? ` — ${initial.moderationNote}` : ''}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'create' ? t('createSubmit') : t('saveSubmit')}
      </button>
    </form>
  );
}
