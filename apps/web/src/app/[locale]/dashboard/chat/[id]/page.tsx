import type { ConversationDetail, ConversationSummary } from '@agrobridge/shared';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { redirect } from '@/i18n/navigation';
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
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  let conversation: ConversationDetail;
  try {
    conversation = await apiRequestAuthed<ConversationDetail>(
      `/conversations/${id}?locale=${encodeURIComponent(locale)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const items = await apiRequestAuthed<ConversationSummary[]>('/conversations');

  return (
    <main className="cabinet-page cabinet-page--chat">
      <ChatWorkspace
        conversations={items}
        active={conversation}
        viewer={{
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        }}
      />
    </main>
  );
}
