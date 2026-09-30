import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Badge, type BadgeTone } from './Badge';
import { Card } from './Card';
import { AppText } from './AppText';

type ProductCardProps = {
  name: string;
  imageUrl: string | null;
  meta: string;
  badgeLabel: string;
  badgeTone: BadgeTone;
  verifiedLabel?: string | null;
  noPhotoLabel: string;
  accessibilityLabel: string;
  width?: number;
  onPress?: () => void;
  farmLink?: {
    name: string;
    place?: string | null;
    onPress: () => void;
    accessibilityLabel: string;
  } | null;
};

export function ProductCard({
  name,
  imageUrl,
  meta,
  badgeLabel,
  badgeTone,
  verifiedLabel,
  noPhotoLabel,
  accessibilityLabel,
  width,
  onPress,
  farmLink,
}: ProductCardProps) {
  const { colors, spacing } = useTheme();
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  const card = (
    <Card accessibilityLabel={onPress ? undefined : accessibilityLabel} style={width && !onPress ? { width } : undefined}>
      <View style={[styles.media, showImage ? null : styles.mediaEmpty]}>
        {showImage ? (
          <Image
            source={{ uri: imageUrl ?? undefined }}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={name}
            onError={() => setFailed(true)}
            transition={0}
          />
        ) : (
          <View style={[styles.image, styles.placeholder, { backgroundColor: colors.neutralSoft }]}>
            <AppText variant="caption" tone="muted">
              {noPhotoLabel}
            </AppText>
          </View>
        )}
      </View>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <AppText variant="bodyStrong">{name}</AppText>
        {meta ? (
          <AppText variant="caption" tone="secondary">
            {meta}
          </AppText>
        ) : null}
        {badgeLabel || verifiedLabel ? (
          <View style={[styles.signals, { gap: spacing.sm }]}>
            {badgeLabel ? <Badge label={badgeLabel} tone={badgeTone} /> : null}
            {verifiedLabel ? (
              <AppText variant="caption" tone="brand" style={styles.verified}>
                {verifiedLabel}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );

  const farmRow = farmLink ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={farmLink.accessibilityLabel}
      onPress={farmLink.onPress}
      style={({ pressed }) => [styles.farmLink, pressed ? styles.pressed : null]}
    >
      <AppText variant="bodyStrong">
        {farmLink.name}
        {' →'}
      </AppText>
      {farmLink.place ? (
        <AppText variant="caption" tone="secondary">
          {farmLink.place}
        </AppText>
      ) : null}
    </Pressable>
  ) : null;

  if (!onPress) {
    return (
      <View style={width ? { width } : undefined}>
        {card}
        {farmRow}
      </View>
    );
  }

  return (
    <View style={width ? { width } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [pressed ? styles.pressed : null]}
      >
        {card}
      </Pressable>
      {farmRow}
    </View>
  );
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    aspectRatio: 1.35,
  },
  mediaEmpty: {
    aspectRatio: 2.6,
  },
  farmLink: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  signals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  verified: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.92,
  },
});
