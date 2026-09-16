import { Lora_400Regular_Italic, Lora_600SemiBold, Lora_700Bold } from "@expo-google-fonts/lora";
import { SourceSans3_400Regular, SourceSans3_600SemiBold, SourceSans3_700Bold } from "@expo-google-fonts/source-sans-3";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { Body, Button, Row, Title } from "@/components/ui";
import { Welcome } from "@/components/welcome";
import { migrate } from "@/db";
import { useAccount } from "@/lib/auth";
import { loadSyncStatus, requestSync } from "@/lib/sync";
import { font, space, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync();

/**
 * On the web the database lives in the browser's origin-private filesystem,
 * which expo-sqlite opens with a sync access handle — and only one of those
 * can exist per file. A second tab, or a reload that beats the previous tab's
 * worker to releasing the file, throws NoModificationAllowedError. The
 * provider rethrows by default, nothing renders, and the page sits blank
 * until the watchdog in +html.tsx reloads it twenty seconds later.
 *
 * The racing-reload case clears itself in a moment, so retry a few times
 * before saying anything. A genuinely second tab doesn't, so then say so.
 */
const DB_OPEN_RETRIES = 3;
const isFileLocked = (e: Error | null) =>
  /NoModificationAllowedError|Access Handle|another open/i.test(e?.message ?? "");

function DatabaseUnavailable({
  locked,
  detail,
  onRetry,
}: {
  locked: boolean;
  detail: string | null;
  onRetry: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.background, alignItems: "center", justifyContent: "center", padding: space.lg }}>
      <View style={{ gap: space.sm, maxWidth: 440 }}>
        <Title>{locked ? "Already open in another tab" : "Couldn't open your greenhouse"}</Title>
        <Body muted>
          {locked
            ? "Your plants are kept in this browser, and only one tab can use them at a time. Close the other PlantParlour tab and try again."
            : "Something went wrong opening the plants kept in this browser. Trying again usually sorts it."}
        </Body>
        <Row>
          <Button title="Try again" variant="primary" onPress={onRetry} />
        </Row>
        {/* What actually failed. On a phone the console is out of reach, and
            "something went wrong" is not something anyone can act on or
            report — this is the line that makes a screenshot worth sending. */}
        {detail ? (
          <Body small muted selectable>
            {detail}
          </Body>
        ) : null}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Lora_700Bold,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
  });

  const [mount, setMount] = useState(0);
  const [failures, setFailures] = useState(0);
  const [dbError, setDbError] = useState<Error | null>(null);
  // Sticky, both of them: retrying churns the VFS, so the *last* error is
  // often "Invalid VFS state" and only the first one names the real cause.
  const [locked, setLocked] = useState(false);
  const [firstError, setFirstError] = useState<string | null>(null);
  const givenUp = dbError !== null && failures > DB_OPEN_RETRIES;

  useEffect(() => {
    if (!dbError || givenUp) return;
    const timer = setTimeout(() => {
      setDbError(null);
      setMount((n) => n + 1);
    }, 400 * 2 ** failures);
    return () => clearTimeout(timer);
  }, [dbError, givenUp, failures]);

  const retry = useCallback(() => {
    setDbError(null);
    setFailures(0);
    setLocked(false);
    setFirstError(null);
    setMount((n) => n + 1);
  }, []);

  const openFailed = useCallback((error: Error) => {
    console.warn("Opening the database failed:", error.message);
    if (isFileLocked(error)) setLocked(true);
    setFirstError((seen) => seen ?? error.message);
    setDbError(error);
    setFailures((n) => n + 1);
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  if (givenUp) return <DatabaseUnavailable locked={locked} detail={firstError} onRetry={retry} />;

  // The database file keeps its original name: renaming it would orphan every
  // existing keeper's plants.
  return (
    <SQLiteProvider
      key={mount}
      databaseName="plant-passport.db"
      onError={openFailed}
      onInit={async (db) => {
        await migrate(db);
        await loadSyncStatus(db);
        requestSync(db, 0);
      }}
    >
      <StatusBar style="light" />
      <RequireAccount>
        <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.background },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: font.serif, fontSize: 17, fontWeight: "600", color: t.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "The Parlour", headerShown: false }} />
        <Stack.Screen name="plant/new" options={{ title: "Add plant", presentation: "modal" }} />
        <Stack.Screen name="plant/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="plant/[id]/edit" options={{ title: "Edit plant", presentation: "modal" }} />
        <Stack.Screen name="account" options={{ title: "Account", presentation: "modal" }} />
        </Stack>
      </RequireAccount>
    </SQLiteProvider>
  );
}

/**
 * The parlour belongs to an account. Anyone without one gets the welcome
 * screen and nothing else — including on a deep link to a plant, which is
 * waiting for them once they are in.
 *
 * Inside the SQLiteProvider, because signing in needs the local database: the
 * codes path marks everything on the device dirty so it pushes into the
 * account. The device database stays as the working copy, so a photo taken
 * with no signal still saves and uploads on the next sync.
 */
function RequireAccount({ children }: PropsWithChildren) {
  const { account, loading } = useAccount();
  // Nothing at all while the session is being read: a flash of the welcome
  // screen for someone who is signed in reads as being logged out.
  if (loading) return null;
  // An account means an email. A leftover anonymous session from before those
  // were turned off is not one, so it gets the welcome screen like anyone else.
  return account && !account.anonymous ? <>{children}</> : <Welcome />;
}
