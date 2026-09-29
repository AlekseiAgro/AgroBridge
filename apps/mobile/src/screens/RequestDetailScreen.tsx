import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { getPurchaseRequest } from '../catalog/api';
import { categoryLabel, requestStatusLabel, unitLabel } from '../catalog/labels';
import type { CatalogRequest } from '../catalog/model';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

type Status = 'loading' | 'ready' | 'error' | 'notFound';

export function RequestDetailScreen() {
  const { locale, t } = useI18n();
  const { colors, spacing } = useTheme();
  const { api } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RequestDetail'>>();
  const requestId = route.params.requestId;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${requestId}:${locale}:${reloadToken}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<Status>('loading');
  const [request, setRequest] = useState<CatalogRequest | null>(null);

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus('loading');
    setRequest(null);
  }

  useEffect(() => {
    let cancelled = false;
    getPurchaseRequest(api, requestId, locale)
      .then((next) => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setStatus('notFound');
          return;
        }
        setRequest(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setStatus(error instanceof ApiError && error.status === 404 ? 'notFound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, locale, requestId, reloadToken]);

  const quantity = request
    ? [request.quantity, unitLabel(request.unit, t)].filter(Boolean).join(' ')
    : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader
          title={request?.title ?? t('requests.title')}
          backLabel={t('common.back')}
          onBack={() => navigation.goBack()}
        />
        {status === 'loading' ? <LoadingSkeleton accessibilityLabel={t('requests.loading')} /> : null}
        {status === 'error' ? (
          <ErrorState
            title={t('requests.loadErrorTitle')}
            body={t('requests.loadErrorBody')}
            retryLabel={t('requests.retry')}
            onRetry={() => setReloadToken((current) => current + 1)}
          />
        ) : null}
        {status === 'notFound' ? (
          <EmptyState title={t('requests.notFoundTitle')} body={t('requests.notFoundBody')} />
        ) : null}
        {status === 'ready' && request ? (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <Chip label={categoryLabel(request.category, t) ?? request.category} />
              <DetailRow label={t('requests.status')} value={requestStatusLabel(request.status, t)} />
              <DetailRow label={t('requests.quantity')} value={quantity} />
              <DetailRow
                label={t('requests.buyer')}
                value={request.buyer.displayName || t('requests.buyerFallback')}
              />
              <DetailRow label={t('requests.variety')} value={request.variety} />
              <DetailRow label={t('requests.packaging')} value={request.packaging} />
              <DetailRow label={t('requests.destination')} value={request.destinationCountry} />
              <DetailRow label={t('product.original')} value={request.sourceTitle} />
              <DetailRow label={t('requests.message')} value={request.message} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
