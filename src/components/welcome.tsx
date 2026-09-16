import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LeafIcon } from "@/components/icons";
import { SignIn } from "@/components/sign-in";
import { Body, Card, SectionLabel } from "@/components/ui";
import { font, space, useTheme } from "@/theme";

/**
 * The front door: what PlantParlour is, who made it, and the one way in.
 *
 * It is the whole welcome now — there was a second copy of it served as static
 * HTML at /welcome, which meant the same words in two places, and they had
 * already drifted apart once. /welcome redirects here.
 *
 * Type runs larger than the rest of the app on purpose. Fifteen-point body is
 * right for a dense screen someone uses every day; it is small for a page a
 * stranger reads cold, once, deciding whether to bother.
 */

const POINTS: { title: string; body: string }[] = [
  {
    title: "Never miss a beat",
    body: "Every plant says what it needs today — water, feed, repot, a fresh photo — on its own schedule, not a species average.",
  },
  {
    title: "Know what you're holding",
    body: "Photograph the whole plant and a close-up or two. They get read together: what it is down to the cultivar, how it's doing, and a care guide for the plant in front of you.",
  },
  {
    title: "Share your treasures",
    body: "Publish a plant and its whole life becomes a link — photos over time, every watering, the issue you treated, the cuttings you took.",
  },
];

function Point({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={styles.point}>
      <View style={styles.pointHead}>
        <View style={[styles.dot, { backgroundColor: t.gold }]} />
        <Text style={[styles.pointTitle, { color: t.text }]}>{title}</Text>
      </View>
      <Body style={[styles.pointBody, { color: t.muted }]}>{body}</Body>
    </View>
  );
}

export function Welcome() {
  const t = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: t.background }]}>
      <View style={styles.masthead}>
        <LeafIcon size={44} color={t.leaf} />
        <Text style={[styles.wordmark, { color: t.text }]}>PlantParlour</Text>
        <Text style={[styles.tagline, { color: t.muted }]}>Every plant, on the record.</Text>
      </View>

      <Card>
        <SectionLabel>Come in</SectionLabel>
        <Body style={styles.story}>
          We're David and Amanda. Our home filled up with plants the way it happens to people — one
          Monstera, then a cutting from a friend, then a Ring of Fire we'd been hunting for a year.
        </Body>
        <Body style={styles.story}>
          We started keeping notes because we cared how they were doing: when each one was watered,
          what a spotted leaf turned out to be, who gave us what. A plant you've kept thriving for
          three years deserves to be remembered properly — and whoever you pass it to deserves to
          know its whole story.
        </Body>
        <Body style={styles.story}>
          That notebook became PlantParlour, and we'd rather share it than keep it. A parlour is the
          room you bring people into to show them what you love.
        </Body>
        <InviteLine>So bring yours in. We'll help you not miss a thing.</InviteLine>
      </Card>

      <View style={styles.points}>
        {POINTS.map((p) => (
          <Point key={p.title} {...p} />
        ))}
      </View>

      <Card>
        <SignIn heading="Start your parlour" />
      </Card>

      <Text style={[styles.footnote, { color: t.muted }]}>
        Already have one? The same button. Your plants follow you to any phone you sign into, and a
        photo taken without a signal uploads the next time you have one.
      </Text>
    </ScrollView>
  );
}

/** The one line that invites rather than explains — Lora italic, in plum. */
function InviteLine({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[styles.invite, { color: t.plum }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  page: {
    padding: space.lg,
    gap: space.lg,
    paddingVertical: space.xl * 2,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  masthead: { alignItems: "center", gap: space.sm },
  wordmark: { fontFamily: font.serifBold, fontSize: 36, lineHeight: 44, textAlign: "center" },
  tagline: { fontFamily: font.serifItalic, fontSize: 18, lineHeight: 26, textAlign: "center" },
  // Reading type, not app type.
  story: { fontSize: 17, lineHeight: 27 },
  invite: { fontFamily: font.serifItalic, fontSize: 18, lineHeight: 27, marginTop: space.xs },
  points: { gap: space.lg, paddingHorizontal: space.xs },
  point: { gap: space.xs },
  pointHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pointTitle: { fontFamily: font.serif, fontSize: 19, lineHeight: 26 },
  pointBody: { fontSize: 16, lineHeight: 25, paddingLeft: space.md + 3 },
  footnote: { fontFamily: font.regular, fontSize: 15, lineHeight: 23, textAlign: "center" },
});
