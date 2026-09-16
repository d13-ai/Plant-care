import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LeafIcon } from "@/components/icons";
import { SignIn } from "@/components/sign-in";
import { Body, Card } from "@/components/ui";
import { font, space, useTheme } from "@/theme";

/**
 * What someone sees before they have an account — the only thing they see, on
 * every route, because the parlour belongs to an account.
 *
 * Deliberately short: a masthead and the way in. The story of who made this
 * and why lives on the public page at /welcome (`api/welcome.ts`), which is
 * the link worth sharing — it is plain HTML that renders before this bundle
 * has downloaded, and it carries the og: tags a forwarded link needs. Saying
 * the same thing in both places meant maintaining the same words twice.
 */
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
        <SignIn heading="Sign in to your parlour" />
      </Card>

      <Body small muted style={styles.footnote}>
        New here? The same button makes your parlour. Your plants follow you to any phone you sign
        into, and a photo taken without a signal uploads the next time you have one.
      </Body>

      {/* Someone who typed the domain in cold has no other way to find out what
          this is, and the sign-in screen shouldn't be where that ends. */}
      {Platform.OS === "web" ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(`${window.location.origin}/welcome`)}
          style={styles.moreLink}
        >
          <Text style={[styles.moreText, { color: t.gold }]}>What PlantParlour is →</Text>
        </Pressable>
      ) : null}
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
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  masthead: { alignItems: "center", gap: space.sm },
  wordmark: { fontFamily: font.serifBold, fontSize: 32, textAlign: "center" },
  tagline: { textAlign: "center", maxWidth: 420 },
  footnote: { textAlign: "center" },
  moreLink: { alignSelf: "center" },
  moreText: { fontFamily: font.medium, fontSize: 14 },
});
