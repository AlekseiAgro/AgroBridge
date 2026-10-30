import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type AvatarProps = {
  label: string;
  accessibilityLabel?: string;
  imageUrl?: string | null;
};

export function Avatar({ label, accessibilityLabel, imageUrl }: AvatarProps) {
  const { colors, touchTarget } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  const size = {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
  };

  if (imageUrl && !imageFailed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel ?? label}
        contentFit="cover"
        onError={() => setImageFailed(true)}
        style={[styles.base, size, { backgroundColor: colors.neutralSoft }]}
      />
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.base, size, { backgroundColor: colors.neutralSoft }]}
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
