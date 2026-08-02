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

  const imageClass =
    variant === 'stacked'
      ? 'brand-logo__image'
      : variant === 'mark'
        ? 'brand-logo__mark-image'
        : 'brand-logo__lockup';

  return (
    <span className={classes}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/brand/logo.png"
        alt="AgroBridge"
        className={imageClass}
      />
    </span>
  );
}
