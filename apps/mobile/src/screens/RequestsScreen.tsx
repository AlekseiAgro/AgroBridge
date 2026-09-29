import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { categoryLabel, unitLabel } from '../catalog/labels';
import { useOpenPurchaseRequests } from '../catalog/use-home-feed';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { RequestCard } from '../components/RequestCard';
import { SectionHeader } from '../components/SectionHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

export function RequestsScreen() {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const stack = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const feed = useOpenPurchaseRequests();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        <SectionHeader title={t('requests.title')} />
        {feed.status === 'loading' ? (
          <LoadingSkeleton accessibilityLabel={t('requests.loading')} />
        ) : null}
        {feed.status === 'error' ? (
          <ErrorState
            title={t('requests.loadErrorTitle')}
            body={t('requests.loadErrorBody')}
            retryLabel={t('requests.retry')}
            onRetry={feed.reload}
          />
        ) : null}
        {feed.status === 'ready' && feed.requests.length === 0 ? (
          <EmptyState
            title={t('requests.emptyTitle')}
            body={t('requests.emptyBody')}
            actionLabel={t('requests.goHome')}
            onAction={() => navigation.navigate('Home')}
          />
        ) : null}
        {feed.status === 'ready'
          ? feed.requests.map((request) => {
              const quantity = [request.quantity, unitLabel(request.unit, t)].filter(Boolean).join(' ');
              const meta = [quantity, request.destinationCountry, request.buyer.displayName]
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={request.id}>
                  <RequestCard
                    title={request.title}
                    meta={meta}
                    categoryLabel={categoryLabel(request.category, t) ?? request.category}
                    accessibilityLabel={t('a11y.openRequest', { name: request.title })}
                    onPress={() => stack?.navigate('RequestDetail', { requestId: request.id })}
                  />
                </View>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
