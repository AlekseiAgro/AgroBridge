import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Chip({ label, selected = false, onPress, accessibilityLabel }: ChipProps) {
  const { colors, radii, spacing, touchTarget, borders } = useTheme();
  const content = (
    <AppText variant="label" tone={selected ? 'inverse' : 'secondary'} style={styles.label}>
      {label}
    </AppText>
  );
  const chrome = {
    minHeight: touchTarget,
    maxWidth: '100%' as const,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    borderColor: selected ? colors.brandDeep : colors.line,
    backgroundColor: selected ? colors.brandDeep : colors.surface,
  };

  if (!onPress) {
    return <View style={[styles.base, chrome]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.base, chrome, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
