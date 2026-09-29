import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

type CardProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export function Card({ style, padded = false, children, ...rest }: CardProps) {
  const { colors, radii, spacing, borders, elevation } = useTheme();

  return (
    <View
      style={[
        styles.base,
        elevation.none,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderWidth: borders.hairline,
          borderRadius: radii.md,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
