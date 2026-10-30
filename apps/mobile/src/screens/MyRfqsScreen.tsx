import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { unitLabel } from '../catalog/labels';
import { AppText } from '../components/AppText';
import { Badge, type BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import type { RootStackParamList } from '../navigation/types';
import {
  RFQ_INITIAL_STATUS,
  partyName,
  retryRfqList,
  rfqDetailParams,
  rfqListPhase,
  rfqLoadPresentation,
} from '../rfq/actions';
import { listMyRfqs } from '../rfq/api';
import { rfqStatusMessageKey, type MobileRfq } from '../rfq/model';
import { useTheme } from '../theme/ThemeProvider';

type Status = typeof RFQ_INITIAL_STATUS | 'ready' | 'error';

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'accepted':
    case 'completed':
      return 'success';
    case 'declined':
    case 'cancelled':
      return 'danger';
    case 'pending':
    case 'offered':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function MyRfqsScreen() {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();
  const { api } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = String(reloadToken);
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<Status>(RFQ_INITIAL_STATUS);
  const [loadErrorKey, setLoadErrorKey] = useState<MessageKey>('rfq.loadErrorBody');
  const [items, setItems] = useState<MobileRfq[]>([]);

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus(RFQ_INITIAL_STATUS);
    setItems([]);
  }

  useEffect(() => {
    let cancelled = false;
    listMyRfqs(api)
      .then((next) => {
        if (cancelled) {
          return;
        }
        setItems(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const presentation = rfqLoadPresentation(error);
        setLoadErrorKey(presentation.messageKey ?? 'rfq.loadErrorBody');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, reloadToken]);

  const phase = rfqListPhase(status, items.length);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader
          title={t('rfq.mineTitle')}
          backLabel={t('common.back')}
          onBack={() => navigation.goBack()}
        />
        {phase === 'loading' ? <LoadingSkeleton accessibilityLabel={t('rfq.loading')} /> : null}
        {phase === 'error' ? (
          <ErrorState
            title={t('rfq.loadErrorTitle')}
            body={t(loadErrorKey)}
            retryLabel={t('rfq.retry')}
            onRetry={() => setReloadToken(retryRfqList)}
          />
        ) : null}
        {phase === 'empty' ? (
          <EmptyState
            title={t('rfq.mineEmptyTitle')}
            body={t('rfq.mineEmptyBody')}
            actionLabel={t('rfq.browseCatalog')}
            onAction={() => navigation.navigate('Catalog')}
          />
        ) : null}
        {phase === 'list'
          ? items.map((item) => {
              const statusKey = rfqStatusMessageKey(item.status);
              const quantity = [item.quantity, unitLabel(item.unit, t)].filter(Boolean).join(' ');
              const seller = item.farm?.name || partyName(item.seller, t('rfq.sellerFallback'));
              const offer = item.offer ? `${item.offer.priceAmount} ${item.offer.currency}` : null;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.product.title}
                  onPress={() => navigation.navigate('RfqDetail', rfqDetailParams(item.id))}
                  style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                >
                  <Card padded>
                    <View style={{ gap: spacing.sm }}>
                      <AppText variant="bodyStrong" numberOfLines={2}>
                        {item.product.title}
                      </AppText>
                      <AppText variant="caption" tone="secondary">
                        {[seller, quantity].filter(Boolean).join(' · ')}
                      </AppText>
                      {offer ? (
                        <AppText variant="caption" tone="secondary">
                          {offer}
                        </AppText>
                      ) : null}
                      <Badge label={statusKey ? t(statusKey) : item.status} tone={statusTone(item.status)} />
                    </View>
                  </Card>
                </Pressable>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
});
