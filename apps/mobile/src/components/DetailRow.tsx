import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type DetailRowProps = {
  label: string;
  value: string | null | undefined;
};

export function DetailRow({ label, value }: DetailRowProps) {
  const { spacing } = useTheme();
  if (!value) {
    return null;
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}
