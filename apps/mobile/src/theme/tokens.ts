/**
 * AgroBridge mobile tokens.
 * Dark values are ready for a later scheme switch. The provider currently applies light.
 * Typography stays on the platform font so Georgian and Cyrillic use OS fallbacks.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const borders = {
  hairline: 1,
} as const;

export const iconSize = {
  sm: 18,
  md: 22,
  lg: 28,
} as const;

/** Minimum interactive size in density-independent pixels. */
export const touchTarget = 44;

export const typography = {
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '600' as const },
} as const;

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
} as const;

export const lightColors = {
  background: '#F6F4F1',
  surface: '#FFFFFF',
  ink: '#1C1917',
  secondary: '#44403C',
  muted: '#57534E',
  line: '#E6E1D8',
  brand: '#2F6B3A',
  brandDeep: '#1F4A28',
  brandSoft: '#E7F0E9',
  inverse: '#FFFFFF',
  danger: '#9F2D2D',
  dangerSoft: '#F8EEEE',
  warning: '#8A5A12',
  warningSoft: '#F8F1E4',
  success: '#1F4A28',
  successSoft: '#E7F0E9',
  neutralSoft: '#F3F0EA',
  skeleton: '#E6E1D8',
} as const;

export const darkColors: { [Key in keyof typeof lightColors]: string } = {
  background: '#141210',
  surface: '#1C1917',
  ink: '#F6F4F1',
  secondary: '#D6D3D1',
  muted: '#A8A29E',
  line: '#3F3A36',
  brand: '#8FBF98',
  brandDeep: '#D7EBDB',
  brandSoft: '#243028',
  inverse: '#141210',
  danger: '#F0B4B4',
  dangerSoft: '#3A2424',
  warning: '#E6C48A',
  warningSoft: '#3A3124',
  success: '#B7D7BE',
  successSoft: '#243028',
  neutralSoft: '#2A2622',
  skeleton: '#3F3A36',
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };
export type ColorSchemeName = 'light' | 'dark';

export const colorSchemes: Record<ColorSchemeName, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
