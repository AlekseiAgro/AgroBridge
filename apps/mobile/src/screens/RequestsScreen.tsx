import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootTabParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

export function RequestsScreen() {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        <SectionHeader title={t('requests.title')} />
        <EmptyState
          title={t('requests.emptyTitle')}
          body={t('requests.emptyBody')}
          actionLabel={t('requests.goHome')}
          onAction={() => navigation.navigate('Home')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
