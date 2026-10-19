import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, Switch, View } from "react-native";
import { ReminderSettings } from "@/components/reminders";
import { Badge, Body, Button, Card, Field, Heading, Row, SectionLabel } from "@/components/ui";
import { pendingChanges } from "@/db";
import { DELETE_WORD, deleteAccount, signOut, useAccount } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { getKeeperName, setKeeperName } from "@/lib/keeper";
import { conservatoryUrl, getHandle, setHandle } from "@/lib/conservatory";
import { getNewsEmails, setNewsEmails } from "@/lib/news";
import { getSyncStatus, requestSync, subscribeSync, syncNow, type SyncStatus } from "@/lib/sync";
import { cardTheme, font, space, useTheme } from "@/theme";

/**
 * The news-email switch. /privacy promises occasional news, no more than
 * monthly, and a way to stop it; this is the way that doesn't depend on
 * anyone reading a reply. Hidden until the setting has been read, so it never
 * shows "on" to someone who turned it off.
 */
function NewsEmails() {
  const t = useTheme();
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNewsEmails()
      .then(setOn)
      .catch(() => setError("Couldn't read this setting just now."));
  }, []);

  const change = async (next: boolean) => {
    const before = on;
    setOn(next);
    setSaving(true);
    setError(null);
    try {
      await setNewsEmails(next);
    } catch {
      setOn(before);
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (on === null && !error) return null;
  return (
    <Card>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>News emails</Heading>
          <Body small muted>
            Now and then, no more than once a month: what's new in PlantParlour. The welcome and password
            emails aren't affected.
          </Body>
        </View>
        {on !== null ? (
          <Switch
            accessibilityLabel="News emails"
            value={on}
            onValueChange={change}
            disabled={saving}
            trackColor={{ true: t.primary, false: t.border }}
          />
        ) : null}
      </Row>
      {error ? <Body small style={{ color: cardTheme.critical.fg }}>{error}</Body> : null}
    </Card>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * The signed-in account: where the greenhouse is backed up to, and the way
 * out. Signing in itself lives on the welcome screen now — nobody reaches
 * this screen without an account, because `RequireAccount` stands in front of
 * every route.
 */
export default function AccountScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { account } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  const [pending, setPending] = useState(0);
  const [handle, setHandleValue] = useState<string | null>(null);
  const [wanted, setWanted] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  // Deleting the account: a second step on this screen, not a dialog, so the
  // list of what goes is read before the word is typed.
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const removeAccount = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(db, typed);
      // Signed out now: the gate in _layout takes this screen away.
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setDeleteBusy(false);
    }
  };

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    getHandle().then(setHandleValue).catch(() => {});
    getKeeperName().then(setName).catch(() => {});
  }, []);

  // The name heads your conservatory and every tag you publish. It is kept on the
  // device and pushed by the sync, so it is saved that way rather than written
  // straight to the server — a direct write would be overwritten by the next
  // push, which sends whatever the device holds.
  const saveName = async () => {
    setSavingName(true);
    try {
      await setKeeperName(name);
      await syncNow(db);
    } catch {
      /* the sync status says if it didn't land */
    } finally {
      setSavingName(false);
    }
  };

  const claim = async () => {
    setClaiming(true);
    setHandleError(null);
    try {
      await setHandle(wanted);
      setHandleValue(wanted.trim());
      setWanted("");
    } catch (err) {
      setHandleError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => subscribeSync(setSync), []);
  useEffect(() => {
    pendingChanges(db).then(setPending);
  }, [db, sync]);

  // Google's redirect lands here. Start the first sync, and tidy the tokens it
  // leaves in the URL.
  //
  // Only the redirect forces a sync. This used to run syncNow on every mount,
  // so each visit to this screen fired one immediately, ahead of the debounce
  // that exists to coalesce them; an ordinary visit now asks like anywhere
  // else and joins whatever is already pending.
  useEffect(() => {
    const fromRedirect =
      Platform.OS === "web" && /access_token|refresh_token|error/.test(window.location.hash);
    if (fromRedirect) {
      syncNow(db).catch(() => {});
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      requestSync(db);
    }
  }, [db]);

  const leave = async () => {
    const ok = await confirm(
      "Sign out?",
      "Your greenhouse stays in your account. This phone stops showing it until you sign in again.",
      { confirmText: "Sign out" },
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Account" }} />

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Heading>Account</Heading>
          <Badge
            label={sync.state === "syncing" ? "Syncing…" : sync.state === "error" ? "Sync failed" : "Backed up"}
            tone={sync.state === "error" ? "critical" : sync.state === "syncing" ? "attention" : "success"}
          />
        </Row>
        <Body>Signed in as {account?.email}</Body>
        <Body small muted>
          Your plants, photos and care history are saved to this account and show up on any phone you sign
          into. Last synced {ago(sync.lastSyncedAt)}
          {pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : ""}.
        </Body>
        {sync.error ? <Body small style={{ color: cardTheme.critical.fg }}>{sync.error}</Body> : null}
        {error ? <Body small style={{ color: cardTheme.critical.fg }}>{error}</Body> : null}
        <Row>
          <Button
            title={sync.state === "syncing" ? "Syncing…" : "Sync now"}
            variant="primary"
            small
            disabled={sync.state === "syncing"}
            onPress={() => syncNow(db).catch(() => {})}
          />
          <Button title="Sign out" small disabled={busy} onPress={leave} />
        </Row>
      </Card>

      <ReminderSettings />

      <NewsEmails />

      <Card>
        <Heading>Your conservatory</Heading>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          placeholder="Amanda"
          hint="Heads your conservatory and every tag you publish. Blank shows “A keeper”."
          maxLength={40}
          onBlur={saveName}
        />
        <Row>
          <Button title={savingName ? "Saving…" : "Save name"} small disabled={savingName} onPress={saveName} />
        </Row>
        {handle ? (
          <>
            <Body>Anyone can visit your published plants at</Body>
            <Body selectable style={{ fontFamily: font.serif }}>{conservatoryUrl(handle)}</Body>
            <Body small muted>
              Only plants you've published appear there — publish one from its own page. Everything
              else stays private.
            </Body>
            <Row>
              <Button title="What's on show" variant="primary" small onPress={() => router.push("/on-show")} />
              <Button
                title="Share"
                small
                // Same as the plant page: on web without navigator.share this
                // rejects, and so does a dismissed sheet. Neither is an error.
                onPress={() =>
                  Share.share({
                    message: `My conservatory: ${conservatoryUrl(handle)}`,
                    url: conservatoryUrl(handle),
                  }).catch(() => {})
                }
              />
            </Row>
          </>
        ) : (
          <>
            <Body small muted>
              Pick a name and your published plants get one page to send people — your
              conservatory — instead of a separate link each. Nothing new becomes public.
            </Body>
            <Field
              label="Handle"
              value={wanted}
              onChangeText={setWanted}
              placeholder="amanda"
              hint="3–20 letters, numbers or underscores. This can't be changed later."
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            <Row>
              <Button
                title={claiming ? "Claiming…" : "Claim it"}
                variant="primary"
                small
                disabled={claiming || wanted.trim().length < 3}
                onPress={claim}
              />
            </Row>
          </>
        )}
        {handleError ? <Body small style={{ color: cardTheme.critical.fg }}>{handleError}</Body> : null}
      </Card>

      <Card>
        <Heading>Your rounds</Heading>
        <Body small muted>
          The conservatories whose calling cards you hold. Leave one at a plant friend's and what
          they put on show turns up here. Find them by handle, or browse the ones keepers have listed.
        </Body>
        <Row>
          <Button title="Your rounds" variant="primary" small onPress={() => router.push("/rounds")} />
          <Button title="Browse conservatories" small onPress={() => router.push("/conservatories")} />
        </Row>
      </Card>

      <Body small muted>
        Signing in on another phone with the same email brings this greenhouse over. Changes made on either
        phone reach the other the next time it opens. A photo taken with no signal saves here and uploads on
        the next sync.
      </Body>

      {/* Landing here from a sign-in redirect is a fresh page load, so there is
          no history to go back to and the modal's own dismiss never appears.
          Without this the screen is a dead end. */}
      {/* While this is still being tested, the way to tell us something broke
          should be somewhere obvious rather than somewhere clever. */}
      <Card>
        <SectionLabel>Found a bug?</SectionLabel>
        <Body small muted>
          Tell us, and the report brings along what the app was doing at the time.
        </Body>
        <Button title="Report a bug" small onPress={() => router.push("/report")} />
      </Card>

      <Row>
        <Button
          title="Go to the parlour"
          variant="primary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      </Row>

      {/* Last on the screen and plainly labelled: easy to find for someone
          looking for it, hard to reach by accident. */}
      <Card>
        <SectionLabel>Delete account</SectionLabel>
        {deleting ? (
          <>
            <Heading>Delete your account for good?</Heading>
            <Body small>This can't be undone. It deletes, straight away:</Body>
            <Body small>
              {"• every plant, photo, care log and note in it\n" +
                "• your published tags and your conservatory page — anyone with those links will find nothing there\n" +
                "• your name, your handle and the calling cards you hold\n" +
                "• your sign-in, and the copy of your plants on this phone"}
            </Body>
            <Body small muted>
              A cutting you gave someone stays theirs; it just stops pointing back to your plant. What the AI cost
              is kept as a daily total with nothing about you on it.
            </Body>
            <Body small muted>
              For your safety it needs a sign-in from the last 30 minutes. If it asks, sign out, sign back in, and
              come back here.
            </Body>
            <Field
              label={`Type ${DELETE_WORD} to confirm`}
              value={typed}
              onChangeText={setTyped}
              placeholder={DELETE_WORD}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Row>
              <Button
                title={deleteBusy ? "Deleting…" : "Delete my account"}
                variant="danger"
                disabled={deleteBusy || typed.trim().toUpperCase() !== DELETE_WORD}
                onPress={removeAccount}
              />
              <Button
                title="Keep it"
                disabled={deleteBusy}
                onPress={() => {
                  setDeleting(false);
                  setTyped("");
                  setDeleteError(null);
                }}
              />
            </Row>
            {deleteError ? <Body small style={{ color: cardTheme.critical.fg }}>{deleteError}</Body> : null}
          </>
        ) : (
          <>
            <Body small muted>
              Deletes your account and everything in it — plants, photos, care history, published tags. You can do
              it here, now; there's no need to ask us.
            </Body>
            <Row>
              <Button title="Delete account…" small onPress={() => setDeleting(true)} />
            </Row>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
});
