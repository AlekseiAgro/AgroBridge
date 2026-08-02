import type { ConversationDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ChatRoom } from '@/components/ChatRoom';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ChatDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });

  const t = await getTranslations('chat');

  let conversation: ConversationDetail;
  try {
    conversation = await apiRequestAuthed<ConversationDetail>(`/conversations/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/dashboard/chat">{t('listTitle')}</Link>
        </p>
        <h1>{conversation.peer.displayName || t('conversation')}</h1>
        <ChatRoom conversationId={conversation.id} initial={conversation} />
      </main>
    </div>
  );
}
