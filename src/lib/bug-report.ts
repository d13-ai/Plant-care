/**
 * "Report a bug", for the people testing this before it is finished.
 *
 * The button is the easy half. The useful half is the trail — what the app
 * was doing in the minute before they pressed it — because a tester saying
 * "it broke" and a developer reading it happen hours apart, and by then the
 * console is gone and the phone is in a pocket.
 *
 * Errors are captured from the moment the app starts, not from the moment
 * the button is pressed, so a report filed after the fact still has the
 * failure in it.
 */
import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { leave, trail } from "@/domain/trail";
import { supabase } from "@/lib/supabase";
import { getSyncStatus } from "@/lib/sync";

/** Bumped by hand at release; tells us which build a report came from. */
export const APP_VERSION = "0.1.0";

let installed = false;

/**
 * Catches what the app would otherwise only print to a console nobody can
 * reach. Called once, as early as possible.
 */
export function watchForTrouble(): void {
  if (installed || Platform.OS !== "web" || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    leave("error", e.message || "script error", {
      // Where, not what: the file and line, never the page's contents.
      source: e.filename ? e.filename.split("/").pop() ?? "" : "",
      line: e.lineno ?? 0,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    leave("error", reason instanceof Error ? reason.message : String(reason ?? "rejected"));
  });

  // console.error is where React's own complaints land — a broken render
  // usually says so here first.
  const original = console.error;
  console.error = (...args: unknown[]) => {
    leave("warn", args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
    original(...args);
  };

  window.addEventListener("online", () => leave("act", "back online"));
  window.addEventListener("offline", () => leave("act", "went offline"));
}

/** Where the app was running. No content, only shape. */
function environment(): Record<string, unknown> {
  const base: Record<string, unknown> = { version: APP_VERSION, platform: Platform.OS };
  if (Platform.OS !== "web" || typeof window === "undefined") return base;
  const nav = window.navigator;
  return {
    ...base,
    ua: nav.userAgent,
    language: nav.language,
    online: nav.onLine,
    // Installed to the home screen, or a browser tab? Changes what storage
    // the app gets, so it changes which bugs are plausible.
    standalone:
      (nav as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches === true,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Cross-origin isolation is what lets the database open at all; when it
    // is false, nothing else will make sense.
    crossOriginIsolated: window.crossOriginIsolated,
  };
}

/**
 * How much is on this device, so a report says whether it synced.
 *
 * Against the local schema, not the server's: a deleted plant is removed from
 * `plants` here and recorded in `sync_tombstones`, so there is no deleted_at
 * column to filter on. Asking for one is what the first real bug report
 * caught — it degraded to "unreadable" rather than failing, which is why the
 * report still arrived, but every report was missing its counts.
 */
export async function localCounts(db: SQLiteDatabase | null): Promise<Record<string, unknown>> {
  if (!db) return { db: "unavailable" };
  try {
    const one = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql))?.n ?? 0;
    return {
      plants: await one("select count(*) as n from plants"),
      dirtyPlants: await one("select count(*) as n from plants where dirty = 1"),
      photos: await one("select count(*) as n from photos"),
      dirtyPhotos: await one("select count(*) as n from photos where dirty = 1"),
      pendingDeletes: await one("select count(*) as n from sync_tombstones"),
    };
  } catch (e) {
    return { db: "unreadable", dbError: e instanceof Error ? e.message : String(e) };
  }
}

export type BugReportResult = { ref: string };

/**
 * Files the report. `db` is optional on purpose: the screen that shows when
 * the database will not open is exactly when someone wants to report a bug,
 * and that is the one moment there is no database to ask.
 */
export async function sendBugReport(note: string, db: SQLiteDatabase | null): Promise<BugReportResult> {
  const { data } = await supabase.auth.getSession();
  const keeperId = data.session?.user.id;
  if (!keeperId) throw new Error("You need to be signed in to send a report.");

  const sync = getSyncStatus();
  const app = {
    ...environment(),
    ...(await localCounts(db)),
    sync: sync.state,
    syncError: sync.error,
    lastSyncedAt: sync.lastSyncedAt,
  };

  // Snapshot before the insert, so the trail ends at the moment they pressed
  // the button rather than including the report's own network call.
  const crumbs = trail.snapshot();

  const { data: row, error } = await supabase
    .from("bug_reports")
    .insert({ keeper_id: keeperId, note: note.trim() || null, app, trail: crumbs })
    .select("ref")
    .single();

  if (error) throw new Error(error.message);
  leave("act", "sent a bug report", { ref: row.ref });
  return { ref: row.ref as string };
}
