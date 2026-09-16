import { Lora_400Regular_Italic, Lora_600SemiBold, Lora_700Bold } from "@expo-google-fonts/lora";
import { SourceSans3_400Regular, SourceSans3_600SemiBold, SourceSans3_700Bold } from "@expo-google-fonts/source-sans-3";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
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
 * which expo-sqlite opens with a sync access handle — only one of those can
 * exist per file, so a second tab, or a page that beats the previous one to
 * releasing it, fails to open.
 *
 * What makes that failure stick is a bug in the worker (expo-sqlite
 * web/worker.ts, maybeInitAsync): it assigns the sqlite3 module *before*
 * creating the VFS. When the VFS creation throws, the module stays set and
 * the VFS stays null — and every later attempt skips the whole init block and
 * throws "Invalid VFS state" instead. The worker is poisoned for the life of
 * the page, so retrying inside it can never work; only a fresh worker can,
 * and that means a reload. Hence the reload below rather than a remount.
 */
const isFileLocked = (e: Error | null) =>
  /NoModificationAllowedError|Access Handle|another open/i.test(e?.message ?? "");

/** Set once a reload has been spent, so a database that cannot open ever
 *  can't put the page in a loop. */
const RELOADED_KEY = "pp-db-reloaded";

/** A fresh worker, which is the only thing that clears a poisoned VFS.
 *  Returns false when the reload has been spent, or can't be tracked. */
function reloadForFreshWorker(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    if (window.sessionStorage.getItem(RELOADED_KEY)) return false;
    window.sessionStorage.setItem(RELOADED_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

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
            : "Something went wrong opening the plants kept in this browser. Your greenhouse is safe in your account — this is only the copy on this phone. Try again, and if it keeps happening, closing the other PlantParlour tabs and reopening usually clears it."}
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
  const [dbError, setDbError] = useState<Error | null>(null);
  const locked = isFileLocked(dbError);

  const retry = useCallback(() => {
    // Spend the reload again: the person asked for it, so a loop is theirs to
    // stop, and a remount would hand them the same poisoned worker.
    if (Platform.OS === "web") {
      try {
        window.sessionStorage.removeItem(RELOADED_KEY);
      } catch {
        /* nothing to clear */
      }
      window.location.reload();
      return;
    }
    setDbError(null);
    setMount((n) => n + 1);
  }, []);

  const openFailed = useCallback((error: Error) => {
    console.warn("Opening the database failed:", error.message);
    // One automatic reload: it costs a second and it fixes the common case,
    // where whatever held the file has since let go.
    if (reloadForFreshWorker()) return;
    setDbError(error);
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // The database file keeps its original name: renaming it would orphan every
  // existing keeper's plants.
  const parlour = dbError ? (
    <DatabaseUnavailable locked={locked} detail={dbError.message} onRetry={retry} />
  ) : (
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
        <Stack.Screen name="on-show" options={{ title: "What's on show", presentation: "modal" }} />
        <Stack.Screen name="rounds" options={{ title: "Your rounds", presentation: "modal" }} />
      </Stack>
    </SQLiteProvider>
  );

  return (
    <>
      <StatusBar style="light" />
      {/* Outside the provider: signing in needs no database, and putting one in
          front of the sign-in screen only gave signing in a way to fail. */}
      <RequireAccount>{parlour}</RequireAccount>
    </>
  );
}

/**
 * The parlour belongs to an account. Anyone without one gets the welcome
 * screen and nothing else — including on a deep link to a plant, which is
 * waiting for them once they are in.
 *
 * It sits *outside* the SQLiteProvider. Someone who has not signed in has no
 * plants on this device, so the sign-in screen has nothing to read — and while
 * it was inside, a database that would not open took the login page down with
 * it. The database opens once there is an account to open it for.
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
