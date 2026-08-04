'use client';

import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
};

export function ChatAvatar({ name, avatarUrl, size = 'sm' }: Props) {
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();
  return (
    <span
      className={size === 'md' ? 'chat-avatar chat-avatar--md' : 'chat-avatar'}
      aria-hidden={avatarUrl ? undefined : true}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={toPublicMediaUrl(avatarUrl)} alt="" />
      ) : (
        <span className="chat-avatar__initial">{initial}</span>
      )}
    </span>
  );
}
