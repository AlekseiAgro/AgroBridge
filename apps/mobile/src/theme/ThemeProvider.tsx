import { createContext, useContext, type ReactNode } from 'react';

import {
  borders,
  colorSchemes,
  elevation,
  iconSize,
  radii,
  spacing,
  touchTarget,
  typography,
  type ColorSchemeName,
  type ThemeColors,
} from './tokens';

export type Theme = {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  borders: typeof borders;
  elevation: typeof elevation;
  iconSize: typeof iconSize;
  touchTarget: number;
  typography: typeof typography;
};

const ThemeContext = createContext<Theme | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  /**
   * Dark tokens exist, but this foundation stays on the light scheme.
   * Pass `dark` only from tests or a future appearance setting.
   */
  scheme?: ColorSchemeName;
};

export function ThemeProvider({ children, scheme = 'light' }: ThemeProviderProps) {
  const theme: Theme = {
    scheme,
    colors: colorSchemes[scheme],
    spacing,
    radii,
    borders,
    elevation,
    iconSize,
    touchTarget,
    typography,
  };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}
