import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { emailVerificationRoute } from '../auth/verify-email-form';
import { listMyPurchaseRequests, listMyQuotes } from '../catalog/api';
import { categoryLabel, requestStatusLabel, unitLabel } from '../catalog/labels';
import type { CatalogRequest } from '../catalog/model';
import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { RequestCard } from '../components/RequestCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { showsCreateRequest } from '../requests/board';
import type { MineQuote } from '../requests/quotes';
import { useTheme } from '../theme/ThemeProvider';

type Kind = 'requests' | 'quotes';
type Status = 'idle' | 'loading' | 'ready' | 'error';

export function MyRequestsScreen() {
  return <PersonalTradeScreen kind="requests" />;
}

export function MyQuotesScreen() {
  return <PersonalTradeScreen kind="quotes" />;
}

function PersonalTradeScreen({ kind }: { kind: Kind }) {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();
  const { api, status: authStatus, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<Status>('idle');
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [quotes, setQuotes] = useState<MineQuote[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const verified = authStatus === 'authenticated' && user != null && !emailVerificationRoute(user);
  const loadKey = `${kind}:${reloadToken}:${verified}`;
  const [seenKey, setSeenKey] = useState(loadKey);
  if (verified && seenKey !== loadKey) {
    setSeenKey(loadKey);
    setStatus('loading');
  }
  const createVisible = showsCreateRequest(kind === 'quotes' ? 'myQuotes' : 'myRequests');

  useEffect(() => {
    if (!verified) return;
    let cancelled = false;
    const load =
      kind === 'requests'
        ? listMyPurchaseRequests(api).then((next) => {
            if (!cancelled) setRequests(next);
          })
        : listMyQuotes(api).then((next) => {
            if (!cancelled) setQuotes(next);
          });
    load
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, kind, reloadToken, verified]);

  const title = kind === 'quotes' ? t('requests.myQuotes') : t('requests.mine');
  const loading = verified && (status === 'loading' || status === 'idle');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        <ScreenHeader title={title} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
        {createVisible ? (
          <AppButton label={t('requests.create')} onPress={() => navigation.navigate('CreateRequest')} />
        ) : null}
        {!verified ? <EmptyState title={title} body={t('requests.signInBody')} /> : null}
        {loading ? <LoadingSkeleton accessibilityLabel={t('requests.loading')} /> : null}
        {verified && status === 'error' ? (
          <ErrorState
            title={t('requests.loadErrorTitle')}
            body={t('requests.loadErrorBody')}
            retryLabel={t('requests.retry')}
            onRetry={() => setReloadToken((current) => current + 1)}
          />
        ) : null}
        {verified && status === 'ready' && kind === 'quotes' && quotes.length === 0 ? (
          <EmptyState title={t('requests.myQuotesEmptyTitle')} body={t('requests.myQuotesEmptyBody')} />
        ) : null}
        {verified && status === 'ready' && kind === 'requests' && requests.length === 0 ? (
          <EmptyState title={t('requests.emptyMineTitle')} body={t('requests.emptyMineBody')} />
        ) : null}
        {verified && status === 'ready' && kind === 'quotes'
          ? quotes.map((quote) => {
              const price = `${quote.priceAmount} ${quote.currency}`;
              const meta = [
                price,
                quote.buyerName,
                requestStatusLabel(quote.requestStatus, t),
                quote.canOpenRequest ? null : t('requests.quoteUnavailable'),
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={quote.id}>
                  <RequestCard
                    title={quote.requestTitle}
                    meta={meta}
                    categoryLabel={quoteStatusLabel(quote.status, t)}
                    accessibilityLabel={t('a11y.openRequest', { name: quote.requestTitle })}
                    onPress={
                      quote.canOpenRequest
                        ? () => navigation.navigate('RequestDetail', { requestId: quote.requestId })
                        : undefined
                    }
                  />
                </View>
              );
            })
          : null}
        {verified && status === 'ready' && kind === 'requests'
          ? requests.map((request) => {
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
                    onPress={() => navigation.navigate('RequestDetail', { requestId: request.id })}
                  />
                </View>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function quoteStatusLabel(
  status: string,
  t: (
    key:
      | 'requests.quoteStatus.pending'
      | 'requests.quoteStatus.accepted'
      | 'requests.quoteStatus.declined'
      | 'requests.quoteStatus.withdrawn',
  ) => string,
): string {
  switch (status) {
    case 'pending':
      return t('requests.quoteStatus.pending');
    case 'accepted':
      return t('requests.quoteStatus.accepted');
    case 'declined':
      return t('requests.quoteStatus.declined');
    case 'withdrawn':
      return t('requests.quoteStatus.withdrawn');
    default:
      return status;
  }
}
