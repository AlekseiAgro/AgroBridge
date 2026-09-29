import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

type LoadingSkeletonProps = {
  accessibilityLabel: string;
};

function SkeletonBlock({
  opacity,
  height,
  width,
  color,
  radius,
}: {
  opacity: Animated.Value;
  height: number;
  width: DimensionValue;
  color: string;
  radius: number;
}) {
  return (
    <Animated.View
      style={{
        opacity,
        height,
        width,
        borderRadius: radius,
        backgroundColor: color,
      }}
    />
  );
}

export function LoadingSkeleton({ accessibilityLabel }: LoadingSkeletonProps) {
  const { colors, radii, spacing } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{ gap: spacing.lg }}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <SkeletonBlock
          opacity={opacity}
          height={36}
          width={108}
          color={colors.skeleton}
          radius={radii.sm}
        />
        <SkeletonBlock
          opacity={opacity}
          height={36}
          width={96}
          color={colors.skeleton}
          radius={radii.sm}
        />
        <SkeletonBlock
          opacity={opacity}
          height={36}
          width={120}
          color={colors.skeleton}
          radius={radii.sm}
        />
      </View>
      <SkeletonBlock
        opacity={opacity}
        height={180}
        width="100%"
        color={colors.skeleton}
        radius={radii.sm}
      />
      <SkeletonBlock
        opacity={opacity}
        height={16}
        width="62%"
        color={colors.skeleton}
        radius={radii.sm}
      />
      <SkeletonBlock
        opacity={opacity}
        height={14}
        width="40%"
        color={colors.skeleton}
        radius={radii.sm}
      />
      <SkeletonBlock
        opacity={opacity}
        height={200}
        width="100%"
        color={colors.skeleton}
        radius={radii.sm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
