import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

type AppIconButtonProps = {
  name: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function AppIconButton({ name, accessibilityLabel, onPress, style }: AppIconButtonProps) {
  const { colors, radii, touchTarget, iconSize } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          width: touchTarget,
          height: touchTarget,
          borderRadius: radii.md,
          backgroundColor: pressed ? colors.neutralSoft : 'transparent',
        },
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize.md} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
