import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type ErrorStateProps = {
  title: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
};

export function ErrorState({ title, body, retryLabel, onRetry }: ErrorStateProps) {
  const { spacing } = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { paddingVertical: spacing.xxl, gap: spacing.sm }]}
    >
      <AppText variant="title" tone="danger" accessibilityRole="header">
        {title}
      </AppText>
      <AppText tone="secondary">{body}</AppText>
      <AppButton label={retryLabel} onPress={onRetry} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'flex-start',
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
});
