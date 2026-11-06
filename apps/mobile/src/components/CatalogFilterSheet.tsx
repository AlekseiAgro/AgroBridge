import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AVAILABILITY, GEORGIA_REGIONS, PRODUCT_CATEGORIES } from '../catalog/categories';
import {
  clearRegions,
  emptyCatalogFilters,
  regionFilterSummary,
  setCatalogFlag,
  toggleRegion,
  toggleSingleFilter,
  type CatalogFilters,
} from '../catalog/filters';
import { categoryLabel, isHarvestStatus, regionLabel } from '../catalog/labels';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { ScreenHeader } from './ScreenHeader';

type Group = 'category' | 'region' | 'harvest' | 'preorder' | 'inSeason';

type CatalogFilterSheetProps = {
  visible: boolean;
  value: CatalogFilters;
  onClose: () => void;
  onApply: (next: CatalogFilters) => void;
};

export function CatalogFilterSheet({ visible, value, onClose, onApply }: CatalogFilterSheetProps) {
  const { t } = useI18n();
  const { colors, spacing, borders } = useTheme();
  const [draft, setDraft] = useState(value);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const openKey = visible ? 'open' : 'closed';
  const [seenOpen, setSeenOpen] = useState(openKey);
  if (seenOpen !== openKey) {
    setSeenOpen(openKey);
    if (visible) {
      setDraft(value);
      setOpenGroup(null);
    }
  }

  const anyLabel = t('catalog.any');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <ScreenHeader title={t('home.filters')} backLabel={t('common.back')} onBack={onClose} />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
          >
            <ChoiceGroup
              title={t('home.categories')}
              summary={draft.categoryId ? (categoryLabel(draft.categoryId, t) ?? draft.categoryId) : anyLabel}
              expanded={openGroup === 'category'}
              onPress={() => setOpenGroup((current) => (current === 'category' ? null : 'category'))}
              hint={t('catalog.chooseOne')}
            >
              <OptionRow
                label={anyLabel}
                selected={draft.categoryId == null}
                onPress={() => setDraft((current) => ({ ...current, categoryId: null }))}
              />
              {PRODUCT_CATEGORIES.map((id) => (
                <OptionRow
                  key={id}
                  label={categoryLabel(id, t) ?? id}
                  selected={draft.categoryId === id}
                  onPress={() => setDraft((current) => toggleSingleFilter(current, 'categoryId', id))}
                />
              ))}
            </ChoiceGroup>
            <ChoiceGroup
              title={t('catalog.region')}
              summary={regionFilterSummary(draft.regions, {
                any: anyLabel,
                single: (id) => regionLabel(id, t) ?? id,
                many: (count) => t('catalog.regionsSelected', { count }),
              })}
              expanded={openGroup === 'region'}
              onPress={() => setOpenGroup((current) => (current === 'region' ? null : 'region'))}
              hint={t('catalog.chooseAny')}
            >
              <OptionRow
                multiple
                label={anyLabel}
                selected={draft.regions.length === 0}
                onPress={() => setDraft((current) => clearRegions(current))}
              />
              {GEORGIA_REGIONS.map((id) => (
                <OptionRow
                  key={id}
                  multiple
                  label={regionLabel(id, t) ?? id}
                  selected={draft.regions.includes(id)}
                  onPress={() => setDraft((current) => toggleRegion(current, id))}
                />
              ))}
            </ChoiceGroup>
            <ChoiceGroup
              title={t('catalog.harvest')}
              summary={
                draft.harvestStatus && isHarvestStatus(draft.harvestStatus)
                  ? t(`availability.${draft.harvestStatus}`)
                  : anyLabel
              }
              expanded={openGroup === 'harvest'}
              onPress={() => setOpenGroup((current) => (current === 'harvest' ? null : 'harvest'))}
              hint={t('catalog.chooseOne')}
            >
              <OptionRow
                label={anyLabel}
                selected={draft.harvestStatus == null}
                onPress={() => setDraft((current) => ({ ...current, harvestStatus: null }))}
              />
              {AVAILABILITY.map((id) => (
                <OptionRow
                  key={id}
                  label={t(`availability.${id}`)}
                  selected={draft.harvestStatus === id}
                  onPress={() => setDraft((current) => toggleSingleFilter(current, 'harvestStatus', id))}
                />
              ))}
            </ChoiceGroup>
            <ChoiceGroup
              title={t('catalog.preorder')}
              summary={draft.preorder ? t('catalog.yes') : anyLabel}
              expanded={openGroup === 'preorder'}
              onPress={() => setOpenGroup((current) => (current === 'preorder' ? null : 'preorder'))}
              hint={t('catalog.chooseOne')}
            >
              <OptionRow
                label={anyLabel}
                selected={!draft.preorder}
                onPress={() => setDraft((current) => setCatalogFlag(current, 'preorder', false))}
              />
              <OptionRow
                label={t('catalog.yes')}
                selected={draft.preorder}
                onPress={() => setDraft((current) => setCatalogFlag(current, 'preorder', true))}
              />
            </ChoiceGroup>
            <ChoiceGroup
              title={t('catalog.inSeason')}
              summary={draft.inSeason ? t('catalog.yes') : anyLabel}
              expanded={openGroup === 'inSeason'}
              onPress={() => setOpenGroup((current) => (current === 'inSeason' ? null : 'inSeason'))}
              hint={t('catalog.chooseOne')}
            >
              <OptionRow
                label={anyLabel}
                selected={!draft.inSeason}
                onPress={() => setDraft((current) => setCatalogFlag(current, 'inSeason', false))}
              />
              <OptionRow
                label={t('catalog.yes')}
                selected={draft.inSeason}
                onPress={() => setDraft((current) => setCatalogFlag(current, 'inSeason', true))}
              />
            </ChoiceGroup>
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              borderTopWidth: borders.hairline,
              borderTopColor: colors.line,
            }}
          >
            <AppButton
              label={t('catalog.reset')}
              variant="secondary"
              onPress={() => setDraft(emptyCatalogFilters())}
              style={{ flex: 1 }}
            />
            <AppButton
              label={t('catalog.showResults')}
              onPress={() => onApply(draft)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ChoiceGroup({
  title,
  summary,
  expanded,
  onPress,
  hint,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onPress: () => void;
  hint: string;
  children: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={{
          minHeight: 56,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" tone="secondary">
            {summary}
          </AppText>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.muted} />
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
          {children}
        </View>
      ) : null}
    </View>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
  multiple = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const icon = selected
    ? multiple
      ? 'checkbox'
      : 'checkmark-circle'
    : multiple
      ? 'square-outline'
      : 'ellipse-outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.brand : colors.muted} />
      <AppText style={{ flex: 1 }} tone={selected ? 'brand' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}
