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
    paddingHorizontal: spacing.lg,
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
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
