import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type AvatarProps = {
  label: string;
  accessibilityLabel?: string;
};

export function Avatar({ label, accessibilityLabel }: AvatarProps) {
  const { colors, touchTarget } = useTheme();
  const initial = label.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        {
          width: touchTarget,
          height: touchTarget,
          borderRadius: touchTarget / 2,
          backgroundColor: colors.neutralSoft,
        },
      ]}
    >
      <AppText variant="label">{initial}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
