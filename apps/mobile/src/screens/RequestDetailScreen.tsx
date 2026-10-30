import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/errors';
import { failureMessageKey } from '../api/user-error';
import { useAuth } from '../auth/AuthProvider';
import { createPurchaseQuote, getPurchaseRequest, postPurchaseRequestAction } from '../catalog/api';
import { PRODUCT_UNITS } from '../catalog/categories';
import { categoryLabel, requestStatusLabel, unitLabel } from '../catalog/labels';
import type { CatalogRequest } from '../catalog/model';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { quotePayload, requestActionNeedsConfirm } from '../requests/form';
import { conversationIdFromCreate } from '../requests/quotes';
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
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [priceAmount, setPriceAmount] = useState('');
  const [currency, setCurrency] = useState('GEL');
  const [quoteQuantity, setQuoteQuantity] = useState('');
  const [quoteUnit, setQuoteUnit] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus('loading');
    setRequest(null);
  }

  useEffect(() => {
    let cancelled = false;
    getPurchaseRequest(api, requestId, locale, true)
      .then((next) => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setStatus('notFound');
          return;
        }
        setRequest(next);
        setQuoteQuantity((current) => current || next.quantity);
        setQuoteUnit((current) => current || next.unit || '');
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
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
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
              <DetailRow
                label={t('requests.createdAt')}
                value={request.createdAt ? request.createdAt.slice(0, 10) : null}
              />
            </View>
          </Card>
        ) : null}
        {status === 'ready' && request ? (
          <RequestActions
            request={request}
            busy={busy}
            actionError={actionError}
            priceAmount={priceAmount}
            currency={currency}
            quoteQuantity={quoteQuantity}
            quoteUnit={quoteUnit}
            quoteMessage={quoteMessage}
            onPrice={setPriceAmount}
            onCurrency={setCurrency}
            onQuantity={setQuoteQuantity}
            onUnit={setQuoteUnit}
            onMessageText={setQuoteMessage}
            onAction={(action, quoteId) => {
              const run = () => {
                setBusy(true);
                setActionError(null);
                postPurchaseRequestAction(api, request.id, action, quoteId)
                  .then(() => setReloadToken((current) => current + 1))
                  .catch((error: unknown) => setActionError(t(failureMessageKey(error))))
                  .finally(() => setBusy(false));
              };
              if (!requestActionNeedsConfirm(action)) {
                run();
                return;
              }
              const label = actionLabel(action, t);
              Alert.alert(label, confirmBody(action, t), [
                { text: t('common.back'), style: 'cancel' },
                {
                  text: label,
                  style: action === 'cancel' || action === 'decline' ? 'destructive' : 'default',
                  onPress: run,
                },
              ]);
            }}
            onQuote={() => {
              const body = quotePayload({
                priceAmount,
                currency,
                quantity: quoteQuantity,
                unit: quoteUnit,
                message: quoteMessage,
              });
              if (!body) {
                setActionError(t('requests.offerInvalid'));
                return;
              }
              setBusy(true);
              setActionError(null);
              createPurchaseQuote(api, request.id, body)
                .then(() => setReloadToken((current) => current + 1))
                .catch((error: unknown) => setActionError(t(failureMessageKey(error))))
                .finally(() => setBusy(false));
            }}
            onMessage={
              request.canMessageBuyer
                ? () => {
                    setBusy(true);
                    setActionError(null);
                    api
                      .request<unknown>('/conversations', {
                        method: 'POST',
                        body: { purchaseRequestId: request.id, locale },
                      })
                      .then((created) => {
                        const conversationId = conversationIdFromCreate(created);
                        if (!conversationId) {
                          setActionError(t('errors.generic'));
                          return;
                        }
                        navigation.navigate('ConversationThread', { conversationId });
                      })
                      .catch((error: unknown) => setActionError(t(failureMessageKey(error))))
                      .finally(() => setBusy(false));
                  }
                : undefined
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function quoteStatusText(
  status: string,
  t: (key:
    | 'requests.quoteStatus.pending'
    | 'requests.quoteStatus.accepted'
    | 'requests.quoteStatus.declined'
    | 'requests.quoteStatus.withdrawn') => string,
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

function confirmBody(
  action: 'cancel' | 'close' | 'accept' | 'decline' | 'withdraw',
  t: (key:
    | 'requests.confirm.cancel'
    | 'requests.confirm.close'
    | 'requests.confirm.accept'
    | 'requests.confirm.decline'
    | 'requests.withdraw') => string,
): string {
  switch (action) {
    case 'cancel':
      return t('requests.confirm.cancel');
    case 'close':
      return t('requests.confirm.close');
    case 'accept':
      return t('requests.confirm.accept');
    case 'decline':
      return t('requests.confirm.decline');
    case 'withdraw':
      return t('requests.withdraw');
  }
}

function actionLabel(
  action: 'cancel' | 'close' | 'accept' | 'decline' | 'withdraw',
  t: (key: 'requests.cancel' | 'requests.close' | 'requests.accept' | 'requests.decline' | 'requests.withdraw') => string,
): string {
  switch (action) {
    case 'cancel':
      return t('requests.cancel');
    case 'close':
      return t('requests.close');
    case 'accept':
      return t('requests.accept');
    case 'decline':
      return t('requests.decline');
    case 'withdraw':
      return t('requests.withdraw');
  }
}

function RequestActions({
  request,
  busy,
  actionError,
  priceAmount,
  currency,
  quoteQuantity,
  quoteUnit,
  quoteMessage,
  onPrice,
  onCurrency,
  onQuantity,
  onUnit,
  onMessageText,
  onAction,
  onQuote,
  onMessage,
}: {
  request: CatalogRequest;
  busy: boolean;
  actionError: string | null;
  priceAmount: string;
  currency: string;
  quoteQuantity: string;
  quoteUnit: string;
  quoteMessage: string;
  onPrice: (value: string) => void;
  onCurrency: (value: string) => void;
  onQuantity: (value: string) => void;
  onUnit: (value: string) => void;
  onMessageText: (value: string) => void;
  onAction: (action: 'cancel' | 'close' | 'accept' | 'decline' | 'withdraw', quoteId?: string) => void;
  onQuote: () => void;
  onMessage?: () => void;
}) {
  const { t } = useI18n();
  const { colors, spacing, radii, borders, typography } = useTheme();
  const quotes = request.quotes ?? [];

  return (
    <View style={{ gap: spacing.md }}>
      {onMessage ? (
        <AppButton label={t('requests.messageBuyer')} loading={busy} onPress={onMessage} />
      ) : null}
      {request.canCancel ? (
        <AppButton label={t('requests.cancel')} variant="secondary" loading={busy} onPress={() => onAction('cancel')} />
      ) : null}
      {request.canClose ? (
        <AppButton label={t('requests.close')} variant="secondary" loading={busy} onPress={() => onAction('close')} />
      ) : null}
      {quotes.length > 0 ? <AppText variant="title">{t('requests.quotes')}</AppText> : null}
      {quotes.map((quote) => (
        <Card key={quote.id} padded>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="bodyStrong">
              {quote.priceAmount} {quote.currency}
            </AppText>
            <AppText tone="secondary">{quote.farmName || quoteStatusText(quote.status, t)}</AppText>
            {quote.quantity ? (
              <AppText tone="secondary">
                {[quote.quantity, unitLabel(quote.unit, t)].filter(Boolean).join(' ')}
              </AppText>
            ) : null}
            {quote.message ? <AppText>{quote.message}</AppText> : null}
            {quote.canAccept ? (
              <AppButton label={t('requests.accept')} loading={busy} onPress={() => onAction('accept', quote.id)} />
            ) : null}
            {quote.canDecline ? (
              <AppButton
                label={t('requests.decline')}
                variant="secondary"
                loading={busy}
                onPress={() => onAction('decline', quote.id)}
              />
            ) : null}
            {quote.canWithdraw ? (
              <AppButton
                label={t('requests.withdraw')}
                variant="ghost"
                loading={busy}
                onPress={() => onAction('withdraw', quote.id)}
              />
            ) : null}
          </View>
        </Card>
      ))}
      {request.canQuote ? (
        <Card padded>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label">{t('requests.offerPrice')}</AppText>
            <TextInput
              value={priceAmount}
              onChangeText={onPrice}
              keyboardType="decimal-pad"
              accessibilityLabel={t('requests.offerPrice')}
              style={{
                minHeight: 44,
                borderWidth: borders.hairline,
                borderColor: colors.line,
                borderRadius: radii.md,
                paddingHorizontal: spacing.md,
                color: colors.ink,
                ...typography.body,
              }}
            />
            <AppText variant="label">{t('requests.offerCurrency')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {['GEL', 'EUR', 'USD'].map((code) => (
                <Chip key={code} label={code} selected={currency === code} onPress={() => onCurrency(code)} />
              ))}
            </View>
            <AppText variant="label">{t('requests.quantity')}</AppText>
            <TextInput
              value={quoteQuantity}
              onChangeText={onQuantity}
              accessibilityLabel={t('requests.quantity')}
              style={{
                minHeight: 44,
                borderWidth: borders.hairline,
                borderColor: colors.line,
                borderRadius: radii.md,
                paddingHorizontal: spacing.md,
                color: colors.ink,
                ...typography.body,
              }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {PRODUCT_UNITS.map((id) => (
                <Chip
                  key={id}
                  label={unitLabel(id, t) ?? id}
                  selected={quoteUnit === id}
                  onPress={() => onUnit(quoteUnit === id ? '' : id)}
                />
              ))}
            </View>
            <AppText variant="label">{t('requests.message')}</AppText>
            <TextInput
              value={quoteMessage}
              onChangeText={onMessageText}
              accessibilityLabel={t('requests.message')}
              multiline
              placeholder={t('requests.quoteMessagePlaceholder')}
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 88,
                borderWidth: borders.hairline,
                borderColor: colors.line,
                borderRadius: radii.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                color: colors.ink,
                ...typography.body,
              }}
            />
            <AppButton label={t('requests.offerSend')} loading={busy} onPress={onQuote} />
          </View>
        </Card>
      ) : null}
      {actionError ? <AppText tone="danger">{actionError}</AppText> : null}
    </View>
  );
}
