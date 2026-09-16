import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LeafIcon } from "@/components/icons";
import { SignIn } from "@/components/sign-in";
import { Body, Card, Heading, Row, SectionLabel } from "@/components/ui";
import { font, space, useTheme } from "@/theme";

/**
 * What someone sees before they have an account — the only thing they see.
 *
 * It is a welcome, not a login form with a tagline on top: where the app came
 * from, what it does for a keeper, and then the way in. The greenhouse used to
 * be open to anyone and nagged about signing in later, which left a keeper's
 * plants in one browser's storage with nothing tying them to a person.
 */

const POINTS: { title: string; body: string }[] = [
  {
    title: "Never miss a beat",
    body: "Every plant says what it needs today — water, feed, repot, a fresh photo — on its own schedule, not a species average. One tap to log it, and an undo when your thumb was faster than your brain.",
  },
  {
    title: "Know what you're holding",
    body: "Photograph the whole plant and a close-up or two. They get read together: what it is down to the cultivar, how it's doing, and a care guide written for the plant in front of you.",
  },
  {
    title: "Share your treasures",
    body: "Publish a plant and its whole life becomes a link — photos over time, every watering, the issue you treated, the cuttings you took. Send it with a trade, a sale, or a plant left with a friend.",
  },
];

function Point({ title, body }: { title: string; body: string }) {
  // These sit on the page, not in a card, so the page's gold — the light one.
  const t = useTheme();
  return (
    <Row style={styles.point}>
      <View style={[styles.dot, { backgroundColor: t.gold }]} />
      <View style={styles.pointText}>
        <Heading>{title}</Heading>
        <Body small muted>{body}</Body>
      </View>
    </Row>
  );
}

export function Welcome() {
  const t = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: t.background }]}>
      <View style={styles.masthead}>
        <LeafIcon size={40} color={t.leaf} />
        <Text style={[styles.wordmark, { color: t.text }]}>PlantParlour</Text>
        <Body muted style={styles.tagline}>Every plant, on the record.</Body>
      </View>

      <Card>
        <SectionLabel>Why we made it</SectionLabel>
        <Body>
          We're two plant people who kept losing the thread. Which one of us fed the Monstera last
          month. Where the Ring of Fire actually came from. What we'd promised the buyer about that
          cutting. Between us we had photos in three places and the history in none.
        </Body>
        <Body>
          So we built the notebook we wanted — and then realised every plant person we know needs the
          same thing. Somewhere your collection is genuinely yours, your rare finds are worth showing
          off, and the plant you pass on carries its whole story to the next keeper.
        </Body>
      </Card>

      <View style={styles.points}>
        {POINTS.map((p) => (
          <Point key={p.title} {...p} />
        ))}
      </View>

      <Card>
        <SignIn heading="Sign in to your parlour" />
      </Card>

      <Body small muted style={styles.footnote}>
        New here? The same button makes your parlour. Your plants follow you to any phone you sign
        into, and a photo taken without a signal uploads the next time you have one.
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, paddingVertical: space.xl * 2, maxWidth: 560, width: "100%", alignSelf: "center" },
  masthead: { alignItems: "center", gap: space.sm },
  wordmark: { fontFamily: font.serifBold, fontSize: 32, textAlign: "center" },
  tagline: { textAlign: "center", maxWidth: 420 },
  points: { gap: space.lg, paddingHorizontal: space.xs },
  point: { alignItems: "flex-start", gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  pointText: { flex: 1, gap: space.xs },
  footnote: { textAlign: "center" },
});
