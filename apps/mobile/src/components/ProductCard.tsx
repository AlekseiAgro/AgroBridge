import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
}: ProductCardProps) {
  const { colors, spacing } = useTheme();
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <Card accessibilityLabel={accessibilityLabel} style={width ? { width } : undefined}>
      <View style={styles.media}>
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
        <AppText variant="caption" tone="secondary">
          {meta}
        </AppText>
        <View style={[styles.signals, { gap: spacing.sm }]}>
          <Badge label={badgeLabel} tone={badgeTone} />
          {verifiedLabel ? (
            <AppText variant="caption" tone="brand" style={styles.verified}>
              {verifiedLabel}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    aspectRatio: 1.35,
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
});
