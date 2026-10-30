import type { ReactNode } from 'react';
import { Switch, TextInput, View } from 'react-native';

import {
  applyCategoryChoice,
  PRICE_CURRENCIES,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  type PriceCurrency,
  type ProductCategory,
  type ProductUnit,
} from '../catalog/categories';
import { categoryLabel, unitLabel } from '../catalog/labels';
import { useI18n } from '../i18n/I18nProvider';
import type { SellerProductFormValues } from '../seller/product-form';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { Card } from './Card';
import { Chip } from './Chip';
import { SellerHarvestSection } from './SellerHarvestSection';
import { SellerLogisticsSection } from './SellerLogisticsSection';

type SellerProductFormProps = {
  values: SellerProductFormValues;
  onChange: (values: SellerProductFormValues) => void;
  pending: boolean;
  issueText: string | null;
  failureText: string | null;
  saveLabel: string;
  onSubmit: () => void;
  saveLoading?: boolean;
  media?: ReactNode;
  publishLabel?: string | null;
  onPublish?: () => void;
  publishLoading?: boolean;
  publishHint?: string | null;
  statusNote?: string | null;
  successText?: string | null;
  publishIssueTexts?: string[];
  publishFailureText?: string | null;
};

export function SellerProductForm({
  values,
  onChange,
  pending,
  issueText,
  failureText,
  saveLabel,
  onSubmit,
  saveLoading,
  media,
  publishLabel,
  onPublish,
  publishLoading = false,
  publishHint,
  statusNote,
  successText,
  publishIssueTexts,
  publishFailureText,
}: SellerProductFormProps) {
  const { t } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const inputStyle = {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.ink,
  };
  const decimalKeyboard = {
    keyboardType: 'decimal-pad' as const,
    inputMode: 'decimal' as const,
  };

  const chooseCategory = (category: ProductCategory | null) => {
    const next = applyCategoryChoice(category, values.unit, values.unitTouched);
    onChange({ ...values, category: next.category, unit: next.unit });
  };

  const chooseUnit = (unit: ProductUnit | null) => {
    onChange({ ...values, unit, unitTouched: true });
  };

  const chooseCurrency = (currency: PriceCurrency | null) => {
    onChange({ ...values, currency });
  };
  const quantityUnit = values.unit ? unitLabel(values.unit, t) : null;
  const quantityFields = [
    ['currentStock', 'seller.draft.currentStock'],
    ['monthlyProduction', 'seller.draft.monthlyProduction'],
    ['maxAnnualProduction', 'seller.draft.maxAnnualProduction'],
    ['minQuantity', 'seller.draft.minQuantity'],
    ['maxQuantity', 'seller.draft.maxQuantity'],
  ] as const;

  const sectionRule = {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.md,
  };

  return (
    <Card padded>
      <View style={{ gap: spacing.lg }}>
        {media ? <View style={{ gap: spacing.lg }}>{media}</View> : null}
        <View style={{ gap: spacing.md }}>
          <AppText variant="bodyStrong">{t('seller.editor.details')}</AppText>
          <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.productTitle')}</AppText>
          <TextInput
            value={values.title}
            onChangeText={(title) => onChange({ ...values, title })}
            editable={!pending}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('seller.draft.productTitle')}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.description')}</AppText>
          <TextInput
            value={values.description}
            onChangeText={(description) => onChange({ ...values, description })}
            editable={!pending}
            multiline
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('seller.draft.description')}
            style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.category')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip
              label={t('seller.draft.notSelected')}
              selected={values.category == null}
              onPress={() => chooseCategory(null)}
            />
            {PRODUCT_CATEGORIES.map((value) => (
              <Chip
                key={value}
                label={categoryLabel(value, t) ?? value}
                selected={values.category === value}
                onPress={() => chooseCategory(value)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.variety')}</AppText>
          <TextInput
            value={values.variety}
            onChangeText={(variety) => onChange({ ...values, variety })}
            editable={!pending}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('seller.draft.variety')}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.country')}</AppText>
          <TextInput
            value={values.country}
            onChangeText={(country) => onChange({ ...values, country })}
            editable={!pending}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('seller.draft.country')}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.originPlace')}</AppText>
          <TextInput
            value={values.originPlace}
            onChangeText={(originPlace) => onChange({ ...values, originPlace })}
            editable={!pending}
            placeholder={t('seller.draft.originPlacePlaceholder')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('seller.draft.originPlace')}
            style={inputStyle}
          />
        </View>
        </View>
        <View style={sectionRule}>
          <AppText variant="bodyStrong">{t('seller.editor.offer')}</AppText>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.unit')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip
              label={t('seller.draft.notSelected')}
              selected={values.unit == null}
              onPress={() => chooseUnit(null)}
            />
            {PRODUCT_UNITS.map((value) => (
              <Chip
                key={value}
                label={unitLabel(value, t) ?? value}
                selected={values.unit === value}
                onPress={() => chooseUnit(value)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
          <AppText variant="label">{t('seller.draft.quantitySection')}</AppText>
          {quantityUnit ? (
            <AppText variant="caption" tone="secondary">
              {t('seller.draft.quantityHint', { unit: quantityUnit })}
            </AppText>
          ) : null}
          {quantityFields.map(([key, label]) => (
            <View key={key} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="label">{t(label)}</AppText>
                {quantityUnit ? (
                  <AppText variant="caption" tone="secondary">
                    {quantityUnit}
                  </AppText>
                ) : null}
              </View>
              <TextInput
                value={values[key]}
                onChangeText={(text) => onChange({ ...values, [key]: text })}
                editable={!pending}
                keyboardType={decimalKeyboard.keyboardType}
                inputMode={decimalKeyboard.inputMode}
                placeholderTextColor={colors.muted}
                accessibilityLabel={t(label)}
                style={inputStyle}
              />
            </View>
          ))}
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.price')}</AppText>
          <TextInput
            value={values.price}
            onChangeText={(price) => onChange({ ...values, price })}
            editable={!pending}
            keyboardType={decimalKeyboard.keyboardType}
            inputMode={decimalKeyboard.inputMode}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('seller.draft.price')}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('seller.draft.currency')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip
              label={t('seller.draft.notSelected')}
              selected={values.currency == null}
              onPress={() => chooseCurrency(null)}
            />
            {PRICE_CURRENCIES.map((value) => (
              <Chip
                key={value}
                label={value}
                selected={values.currency === value}
                onPress={() => chooseCurrency(value)}
              />
            ))}
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <AppText style={{ flex: 1 }}>{t('seller.draft.priceNegotiable')}</AppText>
          <Switch
            value={values.priceNegotiable}
            onValueChange={(priceNegotiable) => onChange({ ...values, priceNegotiable })}
            disabled={pending}
            accessibilityLabel={t('seller.draft.priceNegotiable')}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <AppText style={{ flex: 1 }}>{t('seller.draft.priceDependsOnVolume')}</AppText>
          <Switch
            value={values.priceDependsOnVolume}
            onValueChange={(priceDependsOnVolume) => onChange({ ...values, priceDependsOnVolume })}
            disabled={pending}
            accessibilityLabel={t('seller.draft.priceDependsOnVolume')}
          />
        </View>
        </View>
        <View style={sectionRule}>
          <SellerHarvestSection values={values} pending={pending} onChange={onChange} />
        </View>
        <View style={sectionRule}>
          <SellerLogisticsSection values={values} pending={pending} onChange={onChange} />
        </View>
        <View style={sectionRule}>
          {statusNote ? <AppText tone="secondary">{statusNote}</AppText> : null}
          {issueText ? <AppText tone="danger">{issueText}</AppText> : null}
          {failureText ? <AppText tone="danger">{failureText}</AppText> : null}
          {publishIssueTexts?.map((text, index) => (
            <AppText key={`${index}-${text}`} tone="danger">
              {text}
            </AppText>
          ))}
          {publishFailureText ? <AppText tone="danger">{publishFailureText}</AppText> : null}
          {successText ? <AppText tone="secondary">{successText}</AppText> : null}
          <AppButton
            label={saveLabel}
            onPress={onSubmit}
            variant={publishLabel ? 'secondary' : 'primary'}
            loading={saveLoading ?? pending}
            disabled={pending && !(saveLoading ?? pending)}
          />
          {publishLabel && onPublish ? (
            <AppButton
              label={publishLabel}
              onPress={onPublish}
              loading={publishLoading}
              disabled={pending && !publishLoading}
            />
          ) : null}
          {publishHint ? <AppText tone="secondary">{publishHint}</AppText> : null}
        </View>
      </View>
    </Card>
  );
}
