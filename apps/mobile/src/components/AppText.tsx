import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Variant = 'display' | 'headline' | 'title' | 'body' | 'bodyStrong' | 'label' | 'caption';
type Tone = 'ink' | 'secondary' | 'muted' | 'brand' | 'inverse' | 'danger';

const toneColor: Record<Tone, keyof ThemeColors> = {
  ink: 'ink',
  secondary: 'secondary',
  muted: 'muted',
  brand: 'brandDeep',
  inverse: 'inverse',
  danger: 'danger',
};

type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
};

export function AppText({ variant = 'body', tone = 'ink', style, ...rest }: AppTextProps) {
  const { colors, typography } = useTheme();
  const variantStyle = typography[variant] as TextStyle;

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[variantStyle, { color: colors[toneColor[tone]] }, style]}
      {...rest}
    />
  );
}
