import type { ConversationSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChatListPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });

  const t = await getTranslations('chat');
  const items = await apiRequestAuthed<ConversationSummary[]>('/conversations');

  return (
    <main className="cabinet-page">
        <h1>{t('listTitle')}</h1>
        <p className="page__subtitle">{t('listSubtitle')}</p>

        {items.length === 0 ? (
          <p className="empty-state">{t('listEmpty')}</p>
        ) : (
          <ul className="product-list">
            {items.map((item) => (
              <li key={item.id} className="product-list__item">
                <Link href={`/dashboard/chat/${item.id}`} className="product-list__title">
                  {item.peer.displayName || item.peer.role}
                </Link>
                <p className="product-list__meta">
                  {item.peer.locale.toUpperCase()}
                  {item.lastMessage
                    ? ` · ${item.lastMessage.displayText.slice(0, 80)}`
                    : ` · ${t('noMessagesYet')}`}
                </p>
              </li>
            ))}
          </ul>
        )}
    </main>
  );
}
