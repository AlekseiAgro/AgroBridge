import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.base, { paddingVertical: spacing.xxl, gap: spacing.sm }]}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <AppText tone="secondary" style={styles.body}>
        {body}
      </AppText>
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'flex-start',
  },
  body: {
    flexShrink: 1,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
});
