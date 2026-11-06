import { Switch, TextInput, View } from 'react-native';

import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import {
  CARRIERS,
  INCOTERMS,
  LOGISTICS_LIST_MAX,
  PACKAGING_LIST_MAX,
  PACKAGING_TYPES,
  parsePackagingWeights,
} from '../seller/logistics';
import type { SellerProductFormValues } from '../seller/product-form';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { SellerMultiSelect } from './SellerMultiSelect';

const PACKAGING_KEY: Record<(typeof PACKAGING_TYPES)[number], MessageKey> = {
  carton: 'seller.draft.packaging.carton',
  woodenBox: 'seller.draft.packaging.woodenBox',
  plasticCrate: 'seller.draft.packaging.plasticCrate',
  pallet: 'seller.draft.packaging.pallet',
  bag: 'seller.draft.packaging.bag',
  bulk: 'seller.draft.packaging.bulk',
  other: 'seller.draft.packaging.other',
};

type SellerLogisticsSectionProps = {
  values: SellerProductFormValues;
  pending: boolean;
  onChange: (values: SellerProductFormValues) => void;
};

export function SellerLogisticsSection({ values, pending, onChange }: SellerLogisticsSectionProps) {
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

  const addWeight = (value: string) => {
    const label = t('seller.draft.packagingWeightQuick', { value });
    const current = parsePackagingWeights(values.packagingWeightsText);
    const weights = current === 'invalid' ? [] : current;
    if (weights.includes(label)) {
      return;
    }
    onChange({
      ...values,
      packagingWeightsText: weights.length ? `${weights.join(', ')}, ${label}` : label,
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{t('seller.draft.packagingSection')}</AppText>
      <SellerMultiSelect
        label={t('seller.draft.packagingTypes')}
        disabled={pending}
        options={PACKAGING_TYPES.map((value) => ({ value, label: t(PACKAGING_KEY[value]) }))}
        values={values.packagingTypes}
        onChange={(packagingTypes) => {
          if (packagingTypes.length <= PACKAGING_LIST_MAX) {
            onChange({ ...values, packagingTypes });
          }
        }}
      />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">{t('seller.draft.packagingWeights')}</AppText>
        <TextInput
          value={values.packagingWeightsText}
          onChangeText={(packagingWeightsText) => onChange({ ...values, packagingWeightsText })}
          editable={!pending}
          placeholder={t('seller.draft.packagingWeightsPlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('seller.draft.packagingWeights')}
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {['5', '10', '15'].map((value) => (
            <AppButton
              key={value}
              label={`+ ${t('seller.draft.packagingWeightQuick', { value })}`}
              variant="ghost"
              disabled={pending}
              onPress={() => addWeight(value)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">{t('seller.draft.palletSize')}</AppText>
        <TextInput
          value={values.palletSize}
          onChangeText={(palletSize) => onChange({ ...values, palletSize })}
          editable={!pending}
          accessibilityLabel={t('seller.draft.palletSize')}
          style={inputStyle}
        />
      </View>
      <AppText variant="label">{t('seller.draft.logisticsSection')}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <AppText style={{ flex: 1 }}>{t('seller.draft.deliveryAvailable')}</AppText>
        <Switch
          value={values.deliveryAvailable}
          onValueChange={(deliveryAvailable) => onChange({ ...values, deliveryAvailable })}
          disabled={pending}
          accessibilityLabel={t('seller.draft.deliveryAvailable')}
        />
      </View>
      {values.deliveryAvailable ? (
        <>
          <SellerMultiSelect
            label={t('seller.draft.incoterms')}
            disabled={pending}
            options={INCOTERMS.map((value) => ({ value, label: value }))}
            values={values.incoterms}
            onChange={(incoterms) => {
              if (incoterms.length <= LOGISTICS_LIST_MAX) {
                onChange({ ...values, incoterms });
              }
            }}
          />
          <SellerMultiSelect
            label={t('seller.draft.carriers')}
            disabled={pending}
            options={CARRIERS.map((value) => ({
              value,
              label: value === 'other' ? t('seller.draft.carrierOther') : value,
            }))}
            values={values.carriers}
            onChange={(carriers) => {
              if (carriers.length <= LOGISTICS_LIST_MAX) {
                onChange({ ...values, carriers });
              }
            }}
          />
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t('seller.draft.nearestPort')}</AppText>
            <TextInput
              value={values.nearestPort}
              onChangeText={(nearestPort) => onChange({ ...values, nearestPort })}
              editable={!pending}
              accessibilityLabel={t('seller.draft.nearestPort')}
              style={inputStyle}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t('seller.draft.leadTimeDays')}</AppText>
            <TextInput
              value={values.leadTimeDays}
              onChangeText={(leadTimeDays) => onChange({ ...values, leadTimeDays })}
              editable={!pending}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={t('seller.draft.leadTimeDays')}
              style={inputStyle}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">{t('seller.draft.customDelivery')}</AppText>
            <TextInput
              value={values.customDelivery}
              onChangeText={(customDelivery) => onChange({ ...values, customDelivery })}
              editable={!pending}
              multiline
              accessibilityLabel={t('seller.draft.customDelivery')}
              style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}
