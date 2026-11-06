import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AVAILABILITY, defaultUnitForCategory, type Availability } from '../catalog/categories';
import { unitLabel } from '../catalog/labels';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import {
  calendarDateString,
  calendarParts,
  formatHarvestDate,
  monthGrid,
  SEASON_MONTHS,
  shiftMonth,
  toggleSeasonMonth,
} from '../seller/harvest';
import type { SellerProductFormValues } from '../seller/product-form';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

const MONTH_KEY: Record<(typeof SEASON_MONTHS)[number], MessageKey> = {
  1: 'seller.draft.month.1',
  2: 'seller.draft.month.2',
  3: 'seller.draft.month.3',
  4: 'seller.draft.month.4',
  5: 'seller.draft.month.5',
  6: 'seller.draft.month.6',
  7: 'seller.draft.month.7',
  8: 'seller.draft.month.8',
  9: 'seller.draft.month.9',
  10: 'seller.draft.month.10',
  11: 'seller.draft.month.11',
  12: 'seller.draft.month.12',
};

const STATUS_KEY: Record<Availability, MessageKey> = {
  growing: 'seller.draft.harvestStatus.growing',
  available: 'seller.draft.harvestStatus.available',
  limited: 'seller.draft.harvestStatus.limited',
  soldOut: 'seller.draft.harvestStatus.soldOut',
};

type Sheet = 'months' | 'status' | 'start' | 'end' | null;

type SellerHarvestSectionProps = {
  values: SellerProductFormValues;
  pending: boolean;
  onChange: (values: SellerProductFormValues) => void;
};

export function SellerHarvestSection({ values, pending, onChange }: SellerHarvestSectionProps) {
  const { locale, t } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [cursor, setCursor] = useState(() => currentMonth());
  const forecastUnit = forecastUnitLabel(values, t);
  const inputStyle = {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.ink,
    justifyContent: 'center' as const,
  };

  const openDate = (which: 'start' | 'end') => {
    const current = which === 'start' ? values.harvestStartAt : values.harvestEndAt;
    const parts = calendarParts(current);
    setCursor(parts ? { year: parts.year, month: parts.month } : currentMonth());
    setSheet(which);
  };

  const chooseDate = (day: number) => {
    const next = calendarDateString(cursor.year, cursor.month, day);
    if (sheet === 'start') {
      onChange({ ...values, harvestStartAt: next });
    }
    if (sheet === 'end') {
      onChange({ ...values, harvestEndAt: next });
    }
    setSheet(null);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{t('seller.draft.harvestSection')}</AppText>
      <AppText variant="caption" tone="secondary">
        {t('seller.draft.harvestSubtitle')}
      </AppText>
      <FieldButton
        label={t('seller.draft.seasonMonths')}
        value={
          values.seasonMonths.length
            ? values.seasonMonths.map((month) => t(MONTH_KEY[month as (typeof SEASON_MONTHS)[number]])).join(', ')
            : t('seller.draft.notSelected')
        }
        disabled={pending}
        onPress={() => setSheet('months')}
        style={inputStyle}
      />
      <FieldButton
        label={t('seller.draft.harvestStart')}
        value={values.harvestStartAt ? formatHarvestDate(values.harvestStartAt, locale) : t('seller.draft.chooseDate')}
        disabled={pending}
        onPress={() => openDate('start')}
        style={inputStyle}
      />
      <FieldButton
        label={t('seller.draft.harvestEnd')}
        value={values.harvestEndAt ? formatHarvestDate(values.harvestEndAt, locale) : t('seller.draft.chooseDate')}
        disabled={pending}
        onPress={() => openDate('end')}
        style={inputStyle}
      />
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <AppText variant="label">{t('seller.draft.forecastQuantity')}</AppText>
          <AppText variant="caption" tone="secondary">
            {forecastUnit}
          </AppText>
        </View>
        <TextInput
          value={values.forecastQuantity}
          onChangeText={(forecastQuantity) => onChange({ ...values, forecastQuantity })}
          editable={!pending}
          placeholder={t('seller.draft.forecastPlaceholder')}
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel={t('seller.draft.forecastQuantity')}
          style={inputStyle}
        />
        <AppText variant="caption" tone="secondary">
          {t('seller.draft.forecastUnitHint', { unit: forecastUnit })}
        </AppText>
      </View>
      <FieldButton
        label={t('seller.draft.harvestStatus')}
        value={
          values.harvestStatus ? t(STATUS_KEY[values.harvestStatus]) : t('seller.draft.harvestStatusUnset')
        }
        disabled={pending}
        onPress={() => setSheet('status')}
        style={inputStyle}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <AppText style={{ flex: 1 }}>{t('seller.draft.preorderEnabled')}</AppText>
        <Switch
          value={values.preorderEnabled}
          onValueChange={(preorderEnabled) => onChange({ ...values, preorderEnabled })}
          disabled={pending}
          accessibilityLabel={t('seller.draft.preorderEnabled')}
        />
      </View>
      <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={styles.modal}>
          <Pressable accessibilityLabel={t('product.galleryClose')} style={styles.backdrop} onPress={() => setSheet(null)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.lg }]}>
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
            {sheet === 'months' ? (
              <>
                <AppText variant="title">{t('seller.draft.seasonMonths')}</AppText>
                {SEASON_MONTHS.map((month) => {
                  const selected = values.seasonMonths.includes(month);
                  return (
                    <Pressable
                      key={month}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={t(MONTH_KEY[month])}
                      onPress={() => onChange({ ...values, seasonMonths: toggleSeasonMonth(values.seasonMonths, month) })}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center' }}
                    >
                      <AppText style={{ flex: 1, paddingRight: spacing.sm }}>{t(MONTH_KEY[month])}</AppText>
                      <AppText tone={selected ? 'brand' : 'muted'}>{selected ? '✓' : ''}</AppText>
                    </Pressable>
                  );
                })}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <AppButton
                    label={t('seller.draft.selectAllMonths')}
                    variant="secondary"
                    onPress={() => onChange({ ...values, seasonMonths: [...SEASON_MONTHS] })}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    label={t('seller.draft.clearMonths')}
                    variant="ghost"
                    onPress={() => onChange({ ...values, seasonMonths: [] })}
                    style={{ flex: 1 }}
                  />
                </View>
                <AppButton label={t('seller.draft.done')} onPress={() => setSheet(null)} />
              </>
            ) : null}
            {sheet === 'status' ? (
              <>
                <AppText variant="title">{t('seller.draft.harvestStatus')}</AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange({ ...values, harvestStatus: null });
                    setSheet(null);
                  }}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <AppText>{t('seller.draft.harvestStatusUnset')}</AppText>
                </Pressable>
                {AVAILABILITY.map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    accessibilityLabel={t(STATUS_KEY[status])}
                    onPress={() => {
                      onChange({ ...values, harvestStatus: status });
                      setSheet(null);
                    }}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <AppText tone={values.harvestStatus === status ? 'brand' : 'ink'}>{t(STATUS_KEY[status])}</AppText>
                  </Pressable>
                ))}
              </>
            ) : null}
            {sheet === 'start' || sheet === 'end' ? (
              <>
                <AppText variant="title">
                  {sheet === 'start' ? t('seller.draft.harvestStart') : t('seller.draft.harvestEnd')}
                </AppText>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppButton
                    label="‹"
                    variant="ghost"
                    accessibilityLabel={t('seller.draft.previousMonth')}
                    onPress={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
                  />
                  <AppText variant="label">
                    {t(MONTH_KEY[cursor.month as (typeof SEASON_MONTHS)[number]])} {cursor.year}
                  </AppText>
                  <AppButton
                    label="›"
                    variant="ghost"
                    accessibilityLabel={t('seller.draft.nextMonth')}
                    onPress={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
                  />
                </View>
                <View style={{ flexDirection: 'row' }}>
                  {weekdayLabels(locale).map((label, index) => (
                    <AppText key={`${label}-${index}`} variant="caption" tone="secondary" style={styles.day}>
                      {label}
                    </AppText>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {monthGrid(cursor.year, cursor.month).map((day, index) =>
                    day == null ? (
                      <View key={`blank-${index}`} style={styles.day} />
                    ) : (
                      <Pressable
                        key={day}
                        accessibilityRole="button"
                        accessibilityLabel={String(day)}
                        onPress={() => chooseDate(day)}
                        style={styles.day}
                      >
                        <AppText
                          tone={
                            selectedDay(sheet === 'start' ? values.harvestStartAt : values.harvestEndAt, cursor, day)
                              ? 'brand'
                              : 'ink'
                          }
                        >
                          {day}
                        </AppText>
                      </Pressable>
                    ),
                  )}
                </View>
                <AppButton
                  label={t('seller.draft.clearDate')}
                  variant="ghost"
                  onPress={() => {
                    onChange(
                      sheet === 'start' ? { ...values, harvestStartAt: '' } : { ...values, harvestEndAt: '' },
                    );
                    setSheet(null);
                  }}
                />
              </>
            ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FieldButton({
  label,
  value,
  disabled,
  onPress,
  style,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onPress: () => void;
  style: object;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={style}>
        <AppText>{value}</AppText>
      </Pressable>
    </View>
  );
}

function forecastUnitLabel(
  values: SellerProductFormValues,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  return (
    unitLabel(values.unit, t) ??
    unitLabel(defaultUnitForCategory(values.category), t) ??
    t('seller.draft.noUnit')
  );
}

function currentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function selectedDay(
  value: string,
  cursor: { year: number; month: number },
  day: number,
): boolean {
  const parts = calendarParts(value);
  return parts?.year === cursor.year && parts.month === cursor.month && parts.day === day;
}

function weekdayLabels(locale: string): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + index)),
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88%' },
  day: { width: '14.28%', minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
