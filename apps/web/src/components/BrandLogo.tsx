type Props = {
  variant?: 'horizontal' | 'stacked' | 'mark';
  tone?: 'default' | 'light';
  className?: string;
};

export function BrandLogo({
  variant = 'horizontal',
  tone = 'default',
  className = '',
}: Props) {
  const classes = [
    'brand-logo',
    `brand-logo--${variant}`,
    tone === 'light' ? 'brand-logo--light' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (variant === 'stacked') {
    return (
      <span className={classes}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/brand/agrobridge-logo-transparent.png"
          alt="AgroBridge"
          className="brand-logo__image"
        />
      </span>
    );
  }

  if (variant === 'mark') {
    return (
      <span className={classes}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/brand/agrobridge-mark-transparent.png"
          alt=""
          className="brand-logo__mark-image"
        />
        <span className="sr-only">AgroBridge</span>
      </span>
    );
  }

  return (
    <span className={classes}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/brand/agrobridge-mark-transparent.png"
        alt=""
        className="brand-logo__mark-image"
      />
      <span className="brand-logo__word" aria-hidden="true">
        <span className="brand-logo__agro">Agro</span>
        <span className="brand-logo__bridge">Bridge</span>
      </span>
      <span className="sr-only">AgroBridge</span>
    </span>
  );
}
