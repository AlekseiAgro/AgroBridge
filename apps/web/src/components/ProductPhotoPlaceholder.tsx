type Props = {
  /** Visible caption inside the placeholder. */
  label: string;
  /** Accessible name. Defaults to `label`. */
  alt?: string;
  className?: string;
};

/** Neutral stand-in when a listing has no product-specific photograph. */
export function ProductPhotoPlaceholder({ label, alt, className = '' }: Props) {
  return (
    <div
      className={`product-photo-placeholder ${className}`.trim()}
      role="img"
      aria-label={alt ?? label}
    >
      <span className="product-photo-placeholder__label" aria-hidden>
        {label}
      </span>
    </div>
  );
}
