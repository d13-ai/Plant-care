import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BucketImage } from "@/components/bucket-image";
import { Badge, Body, Button, Row } from "@/components/ui";
import { whatsNew } from "@/domain/calling-cards";
import { PHOTO_SIZES } from "@/domain/photo-uri";
import type { Round } from "@/lib/rounds";
import { photoUrl } from "@/lib/sync";
import { font, radius, space, useTheme } from "@/theme";

/**
 * Someone's conservatory as a card: their name, how much is on show, the
 * newest few photos, and Visit. The same card in the rounds, in a handle
 * lookup and in the directory, so one keeper looks the same wherever you
 * meet them.
 *
 * Visit opens the real page on the web rather than a screen in here — it is
 * the same thing a stranger sees, and the same thing you would send someone.
 */
export function ConservatoryCard({
  round,
  onLongPress,
  onVisit,
  footer,
}: {
  round: Round;
  onLongPress?: () => void;
  /** Told when Visit is tapped, so the rounds can start "what's new" again. */
  onVisit?: () => void;
  /** Under the photos: leaving a card, or saying why there's no need to. */
  footer?: ReactNode;
}) {
  const t = useTheme();
  const news = whatsNew(round.newPlants, round.newPhotos);
  const visit = () => {
    onVisit?.();
    Linking.openURL(round.url).catch(() => {});
  };
  return (
    <Pressable
      onPress={visit}
      onLongPress={onLongPress}
      accessibilityRole="link"
      accessibilityLabel={`Visit ${round.displayName}'s conservatory`}
      style={({ pressed }) => [styles.card, { borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.head}>
        <View style={styles.text}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{round.displayName}</Text>
          <Body small muted>
            @{round.handle} ·{" "}
            {round.onShow === 0
              ? "nothing on show yet"
              : `${round.onShow} ${round.onShow === 1 ? "plant" : "plants"} on show`}
          </Body>
        </View>
        <Button title="Visit" small onPress={visit} />
      </View>
      {news ? (
        <View style={styles.news}>
          <Badge label={`${news} since your last visit`} tone="success" />
        </View>
      ) : null}
      {round.photos.length > 0 ? (
        <View style={styles.strip}>
          {round.photos.map((path) => (
            <BucketImage key={path} uri={photoUrl(path)} size={PHOTO_SIZES.thumb} style={styles.shot} contentFit="cover" />
          ))}
        </View>
      ) : null}
      {footer}
    </Pressable>
  );
}

/**
 * The footer for a conservatory that isn't in your rounds yet. Your own, or
 * one whose card you already hold, says so instead of offering a card the
 * server would refuse or that would change nothing.
 */
export function LeaveCardFooter({
  mine,
  carded,
  busy,
  onLeave,
}: {
  mine: boolean;
  carded: boolean;
  busy: boolean;
  onLeave: () => void;
}) {
  if (mine) return <Body small muted>That's yours.</Body>;
  if (carded) return <Body small muted>✓ In your rounds</Body>;
  return (
    <Row>
      <Button title={busy ? "Leaving…" : "Leave a card"} variant="primary" small disabled={busy} onPress={onLeave} />
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: font.serif, fontSize: 18 },
  news: { flexDirection: "row" },
  strip: { flexDirection: "row", gap: space.sm },
  shot: { flex: 1, aspectRatio: 1, borderRadius: radius.md },
});
