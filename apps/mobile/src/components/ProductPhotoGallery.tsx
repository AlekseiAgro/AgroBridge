import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Photo = {
  id: string;
  url: string;
};

type Props = {
  images: Photo[];
  resolveUrl: (url: string) => string | null;
  emptyLabel: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
};

export function ProductPhotoGallery({
  images,
  resolveUrl,
  emptyLabel,
  closeLabel,
  previousLabel,
  nextLabel,
}: Props) {
  const { colors, radii, spacing } = useTheme();
  const { width, height: windowHeight } = useWindowDimensions();
  const frame = Math.min(width - spacing.lg * 2, 560);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [viewerHeight, setViewerHeight] = useState(0);
  const stripRef = useRef<FlatList<Photo>>(null);
  const viewerRef = useRef<FlatList<Photo>>(null);
  const safeIndex = images.length === 0 ? 0 : Math.min(index, images.length - 1);

  function go(delta: number) {
    if (images.length < 2) {
      return;
    }
    const next = (safeIndex + delta + images.length) % images.length;
    setIndex(next);
    stripRef.current?.scrollToIndex({ index: next, animated: false });
    viewerRef.current?.scrollToIndex({ index: next, animated: true });
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>, pageWidth: number) {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (Number.isFinite(next)) {
      setIndex(Math.max(0, Math.min(images.length - 1, next)));
    }
  }

  if (images.length === 0) {
    return (
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: radii.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.neutralSoft,
          padding: spacing.lg,
        }}
      >
        <AppText tone="muted">{emptyLabel}</AppText>
      </View>
    );
  }

  const counter = `${safeIndex + 1} / ${images.length}`;
  const pageHeight = viewerHeight > 0 ? viewerHeight : windowHeight;

  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <FlatList
          ref={stripRef}
          data={images}
          horizontal
          pagingEnabled
          getItemLayout={(_, itemIndex) => ({
            length: frame,
            offset: frame * itemIndex,
            index: itemIndex,
          })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(event) => onScrollEnd(event, frame)}
          renderItem={({ item }) => {
            const uri = resolveUrl(item.url);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(true)}
                style={{ width: frame, aspectRatio: 1 }}
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', height: '100%', borderRadius: radii.lg }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      borderRadius: radii.lg,
                      backgroundColor: colors.neutralSoft,
                    }}
                  />
                )}
              </Pressable>
            );
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: spacing.sm,
            bottom: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radii.pill,
            backgroundColor: 'rgba(20, 28, 22, 0.72)',
          }}
        >
          <AppText variant="caption" style={{ color: '#f7f4ee' }}>
            {counter}
          </AppText>
        </View>
      </View>

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20, 28, 22, 0.94)' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
            }}
          >
            <AppText style={{ color: '#f7f4ee' }}>{counter}</AppText>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
              <AppText style={{ color: '#f7f4ee' }}>{closeLabel}</AppText>
            </Pressable>
          </View>
          <FlatList
            ref={viewerRef}
            style={{ flex: 1 }}
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={safeIndex}
            getItemLayout={(_, itemIndex) => ({
              length: width,
              offset: width * itemIndex,
              index: itemIndex,
            })}
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              setViewerHeight((current) => (current === nextHeight ? current : nextHeight));
            }}
            onScrollToIndexFailed={({ index: failedIndex }) => {
              viewerRef.current?.scrollToOffset({
                offset: width * failedIndex,
                animated: false,
              });
            }}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => onScrollEnd(event, width)}
            renderItem={({ item }) => {
              const uri = resolveUrl(item.url);
              return (
                <View style={{ width, height: pageHeight, justifyContent: 'center' }}>
                  {uri ? (
                    <Image
                      source={{ uri }}
                      style={{ width, height: pageHeight }}
                      contentFit="contain"
                    />
                  ) : null}
                </View>
              );
            }}
          />
          {images.length > 1 ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                padding: spacing.lg,
              }}
            >
              <Pressable accessibilityRole="button" onPress={() => go(-1)}>
                <AppText style={{ color: '#f7f4ee' }}>{previousLabel}</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => go(1)}>
                <AppText style={{ color: '#f7f4ee' }}>{nextLabel}</AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
