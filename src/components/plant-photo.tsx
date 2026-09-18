import { Image, type ImageContentPosition } from "expo-image";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PHOTO_SIZES } from "@/domain/photo-uri";
import { displayPhotoUri } from "@/lib/photo-uri";
import { radius, useTheme } from "@/theme";

/**
 * A plant photo framed for where it sits. Phone photos are tall; a 4:3
 * crop from the middle shows soil and pot and cuts the leaves. So a hero
 * takes the photo's own shape (within reason) and opens full-size on tap.
 * Thumbnails crop from the centre: the plant is usually there, and a crop
 * from the top showed walls and ceilings instead.
 */
export function PlantPhoto({
  uri: stored,
  mode,
  style,
  children,
}: {
  uri: string;
  mode: "hero" | "thumb";
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  // A photo pulled from another phone is a bucket URL; on the web it has to
  // come through our own origin to survive the page's embedder policy.
  //
  // It is also asked for at the size it will be drawn. A thumbnail is a
  // 320px square (10 KB) rather than the stored 1600px original (704 KB);
  // a hero keeps the photo's shape, because the aspect ratio below is read
  // off the image that actually loads, and a cropped square would report a
  // square. The full-size viewer reuses the hero's URL so opening a photo
  // costs nothing to fetch.
  const uri = displayPhotoUri(stored, mode === "thumb" ? PHOTO_SIZES.thumb : PHOTO_SIZES.full);
  const t = useTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const portrait = ratio != null && ratio < 0.9;
  const position: ImageContentPosition = portrait ? "top" : "center";

  if (mode === "thumb") {
    return <Image source={{ uri }} style={style as never} contentFit="cover" />;
  }

  // Between 4:5 and 3:2 the photo keeps its own shape; beyond that it's cropped, from the top if tall.
  const aspectRatio = ratio == null ? 4 / 3 : Math.min(1.5, Math.max(0.8, ratio));
  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open the photo full size" onPress={() => setOpen(true)} style={style}>
        <Image
          source={{ uri }}
          style={[styles.hero, { aspectRatio }]}
          contentFit="cover"
          contentPosition={position}
          onLoad={(e) => setRatio(e.source.width / e.source.height)}
        />
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={[styles.viewer, { backgroundColor: t.background }]}>
          <View style={styles.viewerInner} pointerEvents="none">
            <Image source={{ uri }} style={styles.full} contentFit="contain" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", borderRadius: radius.lg },
  viewer: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewerInner: { width: "100%", height: "100%" },
  full: { width: "100%", height: "100%" },
});
