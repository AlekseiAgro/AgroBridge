import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type Option = {
  value: string;
  label: string;
};

type SellerMultiSelectProps = {
  label: string;
  options: Option[];
  values: string[];
  disabled?: boolean;
  onChange: (values: string[]) => void;
};

export function SellerMultiSelect({ label, options, values, disabled = false, onChange }: SellerMultiSelectProps) {
  const { t } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const [open, setOpen] = useState(false);
  const summary = values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .join(', ');

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          justifyContent: 'center',
        }}
      >
        <AppText tone={summary ? 'ink' : 'secondary'}>{summary || t('seller.draft.notSelected')}</AppText>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <Pressable
            accessibilityLabel={t('product.galleryClose')}
            style={styles.backdrop}
            onPress={() => setOpen(false)}
          />
          <View style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.lg }]}>
            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              <AppText variant="title">{label}</AppText>
              {options.map((option) => {
                const selected = values.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={option.label}
                    onPress={() =>
                      onChange(
                        selected
                          ? values.filter((value) => value !== option.value)
                          : [...values, option.value],
                      )
                    }
                    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <AppText style={{ flex: 1, paddingRight: spacing.sm }}>{option.label}</AppText>
                    <AppText tone={selected ? 'brand' : 'muted'}>{selected ? '✓' : ''}</AppText>
                  </Pressable>
                );
              })}
              <AppButton label={t('seller.draft.clearMonths')} variant="ghost" onPress={() => onChange([])} />
              <AppButton label={t('seller.draft.done')} onPress={() => setOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88%' },
});
