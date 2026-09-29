import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type SectionHeaderProps = {
  title: string;
};

export function SectionHeader({ title }: SectionHeaderProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ marginBottom: spacing.md }}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    flexShrink: 1,
  },
});
