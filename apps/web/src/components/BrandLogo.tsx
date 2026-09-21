/** Official AgroBridge lockup. Serves the official PNG with a transparent canvas. */
export const AGROBRIDGE_LOGO_SRC = '/brand/agrobridge-logo.png';
export const AGROBRIDGE_LOGO_WIDTH = 1773;
export const AGROBRIDGE_LOGO_HEIGHT = 887;

type Props = {
  className?: string;
};

export function BrandLogo({ className }: Props) {
  return (
    // Exact public PNG — do not run this through next/image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={AGROBRIDGE_LOGO_SRC}
      alt="AgroBridge"
      width={AGROBRIDGE_LOGO_WIDTH}
      height={AGROBRIDGE_LOGO_HEIGHT}
      className={className ? `brand-logo ${className}` : 'brand-logo'}
      decoding="async"
    />
  );
}
