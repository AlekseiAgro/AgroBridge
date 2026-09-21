'use client';

import type { AlertSubscription } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { AlertSubscriptionForm } from '@/components/AlertSubscriptionForm';

type Props = {
  initial: AlertSubscription;
};

export function SettingsEmailAlertsControl({ initial }: Props) {
  const t = useTranslations('cabinet');
  const ts = useTranslations('subscriptions');
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (initial.notifyProducts) parts.push(ts('notifyProducts'));
    if (initial.notifyPurchaseRequests) parts.push(ts('notifyPurchaseRequests'));
    return parts.length > 0 ? parts.join(' · ') : ts('activeAlertsEmpty');
  }, [initial.notifyProducts, initial.notifyPurchaseRequests, ts]);

  if (!open) {
    return (
      <div className="settings-row">
        <p className="settings-row__label">{t('emailNotificationsTitle')}</p>
        <div className="settings-row__body">
          <p className="settings-row__value">{summary}</p>
          <button
            type="button"
            className="settings-row__action"
            onClick={() => {
              setOpen(true);
            }}
          >
            {t('settingsEdit')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-row settings-row--editing">
      <p className="settings-row__label">{t('emailNotificationsTitle')}</p>
      <AlertSubscriptionForm initial={initial} />
      <div className="settings-row__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            setOpen(false);
          }}
        >
          {t('displayNameCancel')}
        </button>
      </div>
    </div>
  );
}
