import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const { colors, radii, spacing, touchTarget, borders } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: touchTarget,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radii.md,
          backgroundColor:
            variant === 'primary'
              ? colors.brandDeep
              : variant === 'secondary'
                ? colors.surface
                : 'transparent',
          borderWidth: variant === 'ghost' ? 0 : borders.hairline,
          borderColor: variant === 'primary' ? colors.brandDeep : colors.line,
        },
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.disabled : null,
        style,
      ]}
    >
      <AppText
        variant="label"
        tone={variant === 'primary' ? 'inverse' : 'ink'}
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
});
