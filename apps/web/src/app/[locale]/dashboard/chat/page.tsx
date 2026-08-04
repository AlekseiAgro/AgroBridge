import type { ConversationSummary } from '@agrobridge/shared';
import { setRequestLocale } from 'next-intl/server';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChatListPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  const items = await apiRequestAuthed<ConversationSummary[]>('/conversations');

  return (
    <main className="cabinet-page cabinet-page--chat">
      <ChatWorkspace
        conversations={items}
        viewer={{
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        }}
      />
    </main>
  );
}
