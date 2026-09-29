import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppIconButton } from './AppIconButton';
import { AppText } from './AppText';

type ScreenHeaderProps = {
  title: string;
  backLabel: string;
  onBack: () => void;
};

export function ScreenHeader({ title, backLabel, onBack }: ScreenHeaderProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <AppIconButton name="chevron-back" accessibilityLabel={backLabel} onPress={onBack} />
      <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </AppText>
    </View>
  );
}
