import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Props = {
  differs: boolean;
  open: boolean;
  onToggle: () => void;
  showOriginalLabel: string;
  showTranslationLabel: string;
  originalLanguageLabel: string;
};

export function ShowOriginal({
  differs,
  open,
  onToggle,
  showOriginalLabel,
  showTranslationLabel,
  originalLanguageLabel,
}: Props) {
  const { spacing } = useTheme();
  if (!differs) {
    return null;
  }
  return (
    <View style={{ gap: spacing.xs }}>
      {open ? (
        <AppText variant="caption" tone="muted">
          {originalLanguageLabel}
        </AppText>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onToggle}>
        <AppText variant="caption" tone="brand">
          {open ? showTranslationLabel : showOriginalLabel}
        </AppText>
      </Pressable>
    </View>
  );
}
