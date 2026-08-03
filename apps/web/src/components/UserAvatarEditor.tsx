'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  avatarUrl: string | null;
  fallbackInitial: string;
};

export function UserAvatarEditor({ avatarUrl, fallbackInitial }: Props) {
  const t = useTranslations('cabinet');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(avatarUrl);

  async function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    const body = new FormData();
    body.append('file', file);

    try {
      const response = await fetch('/api/cabinet/me/avatar', {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as { avatarUrl?: string; message?: string };
      if (!response.ok || !data.avatarUrl) {
        setError(data.message ?? t('avatarUploadError'));
        return;
      }
      setPreviewUrl(data.avatarUrl);
      router.refresh();
    } catch {
      setError(t('avatarUploadError'));
    } finally {
      setPending(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  async function onRemove() {
    if (!previewUrl) return;
    if (!window.confirm(t('avatarRemoveConfirm'))) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/cabinet/me/avatar', { method: 'DELETE' });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('avatarRemoveError'));
        return;
      }
      setPreviewUrl(null);
      router.refresh();
    } catch {
      setError(t('avatarRemoveError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="user-avatar-editor">
      <button
        type="button"
        className="user-card__avatar user-card__avatar--editable"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={t('avatarChange')}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toPublicMediaUrl(previewUrl)} alt="" />
        ) : (
          <span aria-hidden>{fallbackInitial}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => void onUpload(event.target.files)}
      />
      <div className="user-avatar-editor__actions">
        <button
          type="button"
          className="button button--ghost user-avatar-editor__button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? t('avatarUploading') : previewUrl ? t('avatarChange') : t('avatarUpload')}
        </button>
        {previewUrl ? (
          <button
            type="button"
            className="button button--ghost user-avatar-editor__button"
            disabled={pending}
            onClick={() => void onRemove()}
          >
            {t('avatarRemove')}
          </button>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
