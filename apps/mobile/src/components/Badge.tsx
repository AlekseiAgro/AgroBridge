import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { AppText } from './AppText';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

const tonePair: Record<BadgeTone, { background: keyof ThemeColors; text: keyof ThemeColors }> = {
  neutral: { background: 'neutralSoft', text: 'secondary' },
  success: { background: 'successSoft', text: 'success' },
  warning: { background: 'warningSoft', text: 'warning' },
  danger: { background: 'dangerSoft', text: 'danger' },
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors, radii, spacing } = useTheme();
  const pair = tonePair[tone];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors[pair.background],
          borderRadius: radii.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      <AppText variant="caption" style={{ color: colors[pair.text], fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
});
