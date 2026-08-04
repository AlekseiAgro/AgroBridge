import type { ConversationDetail, ConversationSummary } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { ChatAvatar } from '@/components/ChatAvatar';
import { ChatRoom } from '@/components/ChatRoom';
import { Link } from '@/i18n/navigation';

type Viewer = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type Props = {
  conversations: ConversationSummary[];
  active?: ConversationDetail | null;
  viewer: Viewer;
};

export async function ChatWorkspace({ conversations, active, viewer }: Props) {
  const t = await getTranslations('chat');

  return (
    <div className="chat-messenger">
      <aside className="chat-messenger__sidebar">
        <div className="chat-messenger__sidebar-head">
          <h1 className="chat-messenger__title">{t('listTitle')}</h1>
          <p className="chat-messenger__subtitle">{t('listSubtitle')}</p>
        </div>
        {conversations.length === 0 ? (
          <p className="chat-messenger__empty">{t('listEmpty')}</p>
        ) : (
          <ul className="chat-messenger__list">
            {conversations.map((item) => {
              const selected = active?.id === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={`/dashboard/chat/${item.id}`}
                    className={
                      selected
                        ? 'chat-messenger__item chat-messenger__item--active'
                        : 'chat-messenger__item'
                    }
                  >
                    <ChatAvatar
                      name={item.peer.displayName || item.peer.role}
                      avatarUrl={item.peer.avatarUrl}
                      size="md"
                    />
                    <span className="chat-messenger__item-body">
                      <span className="chat-messenger__item-top">
                        <span className="chat-messenger__item-name">
                          {item.peer.displayName || item.peer.role}
                        </span>
                        {item.unreadCount > 0 ? (
                          <span
                            className="chat-nav-link__badge"
                            aria-label={t('unreadCount', { count: item.unreadCount })}
                          >
                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="chat-messenger__item-preview">
                        {item.lastMessage
                          ? item.lastMessage.displayText.slice(0, 72)
                          : t('noMessagesYet')}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="chat-messenger__pane">
        {active ? (
          <>
            <header className="chat-messenger__pane-head">
              <Link href="/dashboard/chat" className="chat-messenger__back">
                {t('backToList')}
              </Link>
              <ChatAvatar
                name={active.peer.displayName || t('conversation')}
                avatarUrl={active.peer.avatarUrl}
                size="md"
              />
              <div className="chat-messenger__pane-titles">
                <Link href={`/users/${active.peer.id}`} className="chat-messenger__peer-name">
                  {active.peer.displayName || t('conversation')}
                </Link>
              </div>
            </header>
            <ChatRoom
              conversationId={active.id}
              initial={active}
              viewer={viewer}
              peer={active.peer}
            />
          </>
        ) : (
          <div className="chat-messenger__placeholder">
            <p>{t('selectConversation')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
