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
  /** Outlined badges stay distinct from filled ones when the label is the main signal. */
  outline?: boolean;
};

export function Badge({ label, tone = 'neutral', outline = false }: BadgeProps) {
  const { colors, radii, spacing, borders } = useTheme();
  const pair = tonePair[tone];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: outline ? colors.surface : colors[pair.background],
          borderRadius: radii.sm,
          borderWidth: outline ? borders.hairline : 0,
          borderColor: colors[pair.text],
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      <AppText variant="caption" style={{ color: colors[pair.text], fontWeight: '600', flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
});
