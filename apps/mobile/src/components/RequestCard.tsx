import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Card } from './Card';
import { Chip } from './Chip';

type RequestCardProps = {
  title: string;
  meta: string;
  categoryLabel: string;
  accessibilityLabel: string;
  onPress?: () => void;
};

export function RequestCard({
  title,
  meta,
  categoryLabel,
  accessibilityLabel,
  onPress,
}: RequestCardProps) {
  const { spacing } = useTheme();
  const card = (
    <Card padded accessibilityLabel={onPress ? undefined : accessibilityLabel}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {meta ? (
          <AppText variant="caption" tone="secondary">
            {meta}
          </AppText>
        ) : null}
        <Chip label={categoryLabel} />
      </View>
    </Card>
  );

  if (!onPress) {
    return card;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
});
