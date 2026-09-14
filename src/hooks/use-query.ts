import { useFocusEffect } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSyncStatus, requestSync, subscribeSync } from "@/lib/sync";

/**
 * Run a read against the local database, re-running whenever the screen
 * regains focus (so a log on the detail screen shows up on the list),
 * whenever `refresh()` is called after a write, and whenever a sync pulls
 * changes made on another device.
 */
export function useQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await query(db));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
    // A refresh follows every write, so this is also where changes get
    // pushed (debounced; a no-op without an account).
    requestSync(db);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Re-query when a sync brings in changes from another device.
  const seenVersion = useRef(getSyncStatus().version);
  useEffect(
    () =>
      subscribeSync((s) => {
        if (s.version !== seenVersion.current) {
          seenVersion.current = s.version;
          refresh();
        }
      }),
    [refresh],
  );

  return { data, error, refresh, db };
}
