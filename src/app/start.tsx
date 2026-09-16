import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LeafIcon } from "@/components/icons";
import { Body, Button, Card, Heading, Row, SectionLabel, Title } from "@/components/ui";
import { useAccount } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import { useWelcomeSeen } from "@/lib/welcome";
import { cardTheme, font, radius, space, useTheme } from "@/theme";

/**
 * The first launch, before the greenhouse. It says what the app is, and it
 * is straight about the split: keeping plants and logging care works with
 * nothing but the phone, while the AI scan, the care guides and the public
 * tags all need an account. Better said here than discovered at the moment
 * someone taps "Scan".
 *
 * Reached automatically from the greenhouse while the welcome flag is unset
 * and there are no plants yet (`src/lib/welcome.ts`); leaving by either
 * button sets the flag, so it is a one-time screen that stays linkable at
 * /start afterwards.
 */

function Point({ children }: { children: string }) {
  return (
    <Row style={styles.point}>
      <View style={[styles.dot, { backgroundColor: cardTheme.gold }]} />
      <Body small style={styles.pointText}>{children}</Body>
    </Row>
  );
}

export default function Start() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, loading } = useAccount();
  const { markSeen } = useWelcomeSeen();
  const signedIn = Boolean(account && !account.anonymous);

  const enter = async () => {
    await markSeen();
    router.replace("/");
  };

  // Sign-in keeps the welcome flag unset on purpose: the account screen is a
  // modal over this one, so closing it comes back here — now offering "Enter
  // the parlour" rather than the pitch a second time.
  const signIn = () => router.push("/account");

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.hero}>
        <SectionLabel>Welcome</SectionLabel>
        <Title>Every plant, on the record.</Title>
        <Body muted>
          A CARFAX for plants. Photograph what you own, log what you do for it, see what it needs
          today — and hand the whole history to whoever you trade or sell it to.
        </Body>
      </View>

      <Card>
        <Heading>Yours from the first tap</Heading>
        <View style={styles.points}>
          <Point>Add plants with photos, and keep a record for each one</Point>
          <Point>Reminders for water, feed, repot and a fresh picture</Point>
          <Point>Log care in one tap — with an undo, and a history you can edit</Point>
          <Point>Take a cutting and it links back to its mother plant</Point>
        </View>
        <Body small muted>No account needed. It all lives on this phone.</Body>
      </Card>

      <Card>
        <Heading>{signedIn ? "Unlocked on your account" : "What an account adds"}</Heading>
        <View style={styles.points}>
          <Point>Identify a plant from your photos, and check its health</Point>
          <Point>Care guides written for the plant in front of you</Point>
          <Point>Publish a tag — a link that hands the record over</Point>
          <Point>Backup, and the same greenhouse on any phone you sign into</Point>
        </View>
        {signedIn ? (
          <Body small muted>Signed in as {account!.email}. Everything above is on.</Body>
        ) : (
          <Body small muted>
            Scanning, care guides and tags all need an account — there is no way round it, they run on
            the server. Signing in is an email and a 6-digit code, or one tap with Google.
          </Body>
        )}
      </Card>

      <View style={styles.actions}>
        {signedIn || !supabaseConfigured ? (
          <Button title="Enter the parlour" variant="primary" onPress={enter} />
        ) : (
          <>
            <Button title={loading ? "Sign in" : "Sign in and get everything"} variant="primary" onPress={signIn} />
            <Button title="Start without an account" onPress={enter} />
          </>
        )}
      </View>

      <View style={[styles.band, { backgroundColor: t.plum, borderColor: t.hairline }]}>
        <Text style={[styles.tagline, { color: t.goldText }]}>Rare plants. Real community. Real pride.</Text>
        <LeafIcon color={t.goldText} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.lg, gap: space.lg, maxWidth: 560, width: "100%", alignSelf: "center" },
  hero: { gap: space.sm, paddingHorizontal: 4 },
  points: { gap: space.sm },
  point: { flexWrap: "nowrap", alignItems: "flex-start", gap: space.md },
  dot: { width: 6, height: 6, borderRadius: 999, marginTop: 6 },
  pointText: { flex: 1 },
  actions: { gap: space.sm },
  band: {
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  tagline: { fontFamily: font.serifItalic, fontStyle: "italic", fontSize: 14, lineHeight: 18, flex: 1 },
});
