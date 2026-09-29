import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  clearLabel?: string;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  clearLabel,
}: SearchBarProps) {
  const { colors, radii, spacing, touchTarget, iconSize, borders, typography } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          minHeight: touchTarget + spacing.xs,
          borderRadius: radii.md,
          borderWidth: borders.hairline,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          paddingLeft: spacing.md,
          paddingRight: spacing.xs,
        },
      ]}
    >
      <Ionicons name="search-outline" size={iconSize.sm} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={[
          styles.input,
          typography.body,
          {
            color: colors.ink,
            marginLeft: spacing.sm,
            paddingVertical: spacing.md,
          },
        ]}
      />
      {value.length > 0 && clearLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          style={[styles.clear, { width: touchTarget, height: touchTarget }]}
        >
          <Ionicons name="close" size={iconSize.sm} color={colors.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 0,
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
