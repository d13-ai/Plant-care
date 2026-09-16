import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LeafIcon } from "@/components/icons";
import { SignIn } from "@/components/sign-in";
import { Body, Card } from "@/components/ui";
import { font, space, useTheme } from "@/theme";

/**
 * What someone sees before they have an account — the only thing they see.
 *
 * The greenhouse used to be open to anyone and nagged about signing in later,
 * which meant a keeper's plants sat in one browser's storage with nothing
 * tying them to a person. An account is the front door now: the plants belong
 * to the keeper, not to the device that happened to enter them.
 */
export function Welcome() {
  const t = useTheme();
  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: t.background }]}>
      <View style={styles.masthead}>
        <LeafIcon size={40} color={t.leaf} />
        <Text style={[styles.wordmark, { color: t.text }]}>PlantParlour</Text>
        <Body muted style={styles.tagline}>
          A greenhouse that remembers. Every plant's history, what it needs next, and where it came
          from — kept for the keeper, not the phone.
        </Body>
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
  page: {
    padding: space.lg,
    gap: space.lg,
    paddingVertical: space.xl * 2,
    flexGrow: 1,
    justifyContent: "center",
  },
  masthead: { alignItems: "center", gap: space.sm },
  wordmark: { fontFamily: font.serifBold, fontSize: 32, textAlign: "center" },
  tagline: { textAlign: "center", maxWidth: 420 },
  footnote: { textAlign: "center" },
});
