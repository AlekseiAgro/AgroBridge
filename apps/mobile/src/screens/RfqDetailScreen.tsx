import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { PRICE_CURRENCIES, PRODUCT_UNITS, isProductUnit } from '../catalog/categories';
import { regionLabel, unitLabel } from '../catalog/labels';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Badge, type BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import type { RootStackParamList } from '../navigation/types';
import { conversationIdFromCreate } from '../requests/quotes';
import {
  RFQ_INITIAL_STATUS,
  canMessageRfq,
  partyName,
  rfqActionErrorKey,
  rfqActionNeedsConfirm,
  rfqActions,
  rfqLoadPresentation,
  rfqOfferPayload,
  rfqRole,
  type RfqActionId,
} from '../rfq/actions';
import { createRfqConversation, deleteRfq, getRfq, postRfqAction, postRfqOffer } from '../rfq/api';
import { rfqStatusMessageKey, type MobileRfq } from '../rfq/model';
import { useTheme } from '../theme/ThemeProvider';

type Status = typeof RFQ_INITIAL_STATUS | 'ready' | 'error' | 'notFound' | 'forbidden';

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

export function RfqDetailScreen() {
  const { locale, t } = useI18n();
  const { colors, spacing, radii, borders, typography } = useTheme();
  const { api, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RfqDetail'>>();
  const rfqId = route.params.rfqId;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${rfqId}:${reloadToken}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<Status>(RFQ_INITIAL_STATUS);
  const [loadErrorKey, setLoadErrorKey] = useState<MessageKey>('rfq.loadErrorBody');
  const [rfq, setRfq] = useState<MobileRfq | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [seededId, setSeededId] = useState<string | null>(null);
  const [priceAmount, setPriceAmount] = useState('');
  const [currency, setCurrency] = useState('GEL');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus(RFQ_INITIAL_STATUS);
    setRfq(null);
    setActionError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getRfq(api, rfqId)
      .then((next) => {
        if (cancelled) {
          return;
        }
        setRfq(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const presentation = rfqLoadPresentation(error);
        setStatus(presentation.status);
        if (presentation.messageKey) {
          setLoadErrorKey(presentation.messageKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, rfqId, reloadToken]);

  if (rfq && seededId !== rfq.id) {
    setSeededId(rfq.id);
    setPriceAmount('');
    setCurrency('GEL');
    setQuantity(rfq.quantity);
    setUnit(rfq.unit && isProductUnit(rfq.unit) ? rfq.unit : '');
    setOfferMessage('');
  }

  const role = rfq ? rfqRole(rfq, user?.id) : null;
  const actions = rfq ? rfqActions(rfq, role) : [];
  const statusKey = rfq ? rfqStatusMessageKey(rfq.status) : null;
  const quantityText = rfq ? [rfq.quantity, unitLabel(rfq.unit, t)].filter(Boolean).join(' ') : null;
  const offerQuantity = rfq?.offer
    ? [rfq.offer.quantity, unitLabel(rfq.offer.unit, t)].filter(Boolean).join(' ')
    : null;

  const reload = () => setReloadToken((current) => current + 1);

  const fail = (error: unknown) => {
    setActionError(t(rfqActionErrorKey(error)));
  };

  const confirm = (action: RfqActionId, label: string, run: () => void) => {
    if (!rfqActionNeedsConfirm(action)) {
      run();
      return;
    }
    const destructive = action === 'decline' || action === 'cancel' || action === 'delete';
    Alert.alert(label, confirmBody(action, t), [
      { text: t('common.back'), style: 'cancel' },
      { text: label, style: destructive ? 'destructive' : 'default', onPress: run },
    ]);
  };

  const perform = (action: 'accept' | 'decline' | 'cancel' | 'complete' | 'delete') => {
    const label = actionLabel(action, t);
    confirm(action, label, () => {
      setBusy(true);
      setActionError(null);
      const task =
        action === 'delete' ? deleteRfq(api, rfqId) : postRfqAction(api, rfqId, action);
      task
        .then(() => {
          if (action === 'delete') {
            navigation.goBack();
            return;
          }
          reload();
        })
        .catch(fail)
        .finally(() => setBusy(false));
    });
  };

  const submitOffer = () => {
    const body = rfqOfferPayload({
      priceAmount,
      currency,
      quantity,
      unit,
      message: offerMessage,
    });
    if (!body) {
      setActionError(t('rfq.offerInvalid'));
      return;
    }
    setBusy(true);
    setActionError(null);
    postRfqOffer(api, rfqId, body)
      .then(reload)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const openChat = () => {
    setBusy(true);
    setActionError(null);
    createRfqConversation(api, rfqId, locale)
      .then((created) => {
        const conversationId = conversationIdFromCreate(created);
        if (!conversationId) {
          setActionError(t('errors.generic'));
          return;
        }
        navigation.navigate('ConversationThread', { conversationId });
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const inputStyle = {
    minHeight: 44,
    borderWidth: borders.hairline,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
    ...typography.body,
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xxxl,
            gap: spacing.lg,
          }}
        >
          <ScreenHeader
            title={rfq?.product.title ?? t('rfq.screenTitle')}
            backLabel={t('common.back')}
            onBack={() => navigation.goBack()}
          />
          {status === 'loading' ? <LoadingSkeleton accessibilityLabel={t('rfq.loading')} /> : null}
          {status === 'error' ? (
            <ErrorState
              title={t('rfq.loadErrorTitle')}
              body={t(loadErrorKey)}
              retryLabel={t('rfq.retry')}
              onRetry={reload}
            />
          ) : null}
          {status === 'notFound' ? (
            <EmptyState title={t('rfq.notFoundTitle')} body={t('rfq.notFoundBody')} />
          ) : null}
          {status === 'forbidden' ? (
            <ErrorState
              title={t('rfq.forbiddenTitle')}
              body={t('rfq.forbiddenBody')}
              retryLabel={t('rfq.retry')}
              onRetry={reload}
            />
          ) : null}
          {status === 'ready' && rfq ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <Badge label={statusKey ? t(statusKey) : rfq.status} tone={statusTone(rfq.status)} />
                <DetailRow label={t('rfq.quantity')} value={quantityText} />
                <DetailRow label={t('rfq.message')} value={rfq.message} />
                {role !== 'seller' ? (
                  <DetailRow
                    label={t('rfq.seller')}
                    value={partyName(rfq.seller, t('rfq.sellerFallback'))}
                  />
                ) : null}
                {role !== 'buyer' ? (
                  <DetailRow
                    label={t('rfq.buyer')}
                    value={partyName(rfq.buyer, t('rfq.buyerFallback'))}
                  />
                ) : null}
                <DetailRow label={t('rfq.farm')} value={rfq.farm?.name} />
                <DetailRow label={t('catalog.region')} value={regionLabel(rfq.farm?.region, t)} />
              </View>
            </Card>
          ) : null}
          {status === 'ready' && rfq?.offer ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText variant="title">{t('rfq.offer')}</AppText>
                <DetailRow
                  label={t('rfq.offerPrice')}
                  value={`${rfq.offer.priceAmount} ${rfq.offer.currency}`}
                />
                <DetailRow label={t('rfq.quantity')} value={offerQuantity} />
                <DetailRow label={t('rfq.offerMessage')} value={rfq.offer.message} />
                <DetailRow
                  label={t('rfq.validUntil')}
                  value={rfq.offer.validUntil ? rfq.offer.validUntil.slice(0, 10) : null}
                />
              </View>
            </Card>
          ) : null}
          {status === 'ready' && rfq ? (
            <View style={{ gap: spacing.md }}>
              {canMessageRfq(role) ? (
                <AppButton label={t('rfq.messageParty')} loading={busy} onPress={openChat} />
              ) : null}
              {actions.includes('accept') ? (
                <AppButton label={t('rfq.accept')} loading={busy} onPress={() => perform('accept')} />
              ) : null}
              {actions.includes('complete') ? (
                <AppButton label={t('rfq.complete')} loading={busy} onPress={() => perform('complete')} />
              ) : null}
              {actions.includes('cancel') ? (
                <AppButton
                  label={t('rfq.cancel')}
                  variant="secondary"
                  loading={busy}
                  onPress={() => perform('cancel')}
                />
              ) : null}
              {actions.includes('decline') ? (
                <AppButton
                  label={t('rfq.decline')}
                  variant="secondary"
                  loading={busy}
                  onPress={() => perform('decline')}
                />
              ) : null}
              {actions.includes('delete') ? (
                <AppButton
                  label={t('rfq.delete')}
                  variant="secondary"
                  loading={busy}
                  onPress={() => perform('delete')}
                />
              ) : null}
              {actions.includes('offer') ? (
                <Card padded>
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="title">{t('rfq.makeOffer')}</AppText>
                    <AppText variant="label">{t('rfq.offerPrice')}</AppText>
                    <TextInput
                      value={priceAmount}
                      onChangeText={setPriceAmount}
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('rfq.offerPrice')}
                      style={inputStyle}
                    />
                    <AppText variant="label">{t('rfq.offerCurrency')}</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {PRICE_CURRENCIES.map((code) => (
                        <Chip
                          key={code}
                          label={code}
                          selected={currency === code}
                          onPress={() => setCurrency(code)}
                        />
                      ))}
                    </View>
                    <AppText variant="label">{t('rfq.quantity')}</AppText>
                    <TextInput
                      value={quantity}
                      onChangeText={setQuantity}
                      accessibilityLabel={t('rfq.quantity')}
                      style={inputStyle}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {PRODUCT_UNITS.map((code) => (
                        <Chip
                          key={code}
                          label={unitLabel(code, t) ?? code}
                          selected={unit === code}
                          onPress={() => setUnit(code)}
                        />
                      ))}
                    </View>
                    <AppText variant="label">{t('rfq.offerMessage')}</AppText>
                    <TextInput
                      value={offerMessage}
                      onChangeText={setOfferMessage}
                      multiline
                      accessibilityLabel={t('rfq.offerMessage')}
                      style={[inputStyle, { minHeight: 88, paddingTop: spacing.md }]}
                    />
                    <AppButton label={t('rfq.sendOffer')} loading={busy} onPress={submitOffer} />
                  </View>
                </Card>
              ) : null}
              {actionError ? (
                <AppText tone="danger" accessibilityRole="alert">
                  {actionError}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function confirmBody(
  action: RfqActionId,
  t: (key: MessageKey) => string,
): string {
  switch (action) {
    case 'accept':
      return t('rfq.confirm.accept');
    case 'decline':
      return t('rfq.confirm.decline');
    case 'complete':
      return t('rfq.confirm.complete');
    case 'cancel':
      return t('rfq.confirm.cancel');
    case 'delete':
      return t('rfq.confirm.delete');
    case 'offer':
      return '';
  }
}

function actionLabel(
  action: 'accept' | 'decline' | 'cancel' | 'complete' | 'delete',
  t: (key: MessageKey) => string,
): string {
  switch (action) {
    case 'accept':
      return t('rfq.accept');
    case 'decline':
      return t('rfq.decline');
    case 'cancel':
      return t('rfq.cancel');
    case 'complete':
      return t('rfq.complete');
    case 'delete':
      return t('rfq.delete');
  }
}
