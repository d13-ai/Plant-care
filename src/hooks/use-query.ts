import { useFocusEffect } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useState } from "react";

/**
 * Run a read against the local database, re-running whenever the screen
 * regains focus (so a log on the detail screen shows up on the list) and
 * whenever `refresh()` is called after a write.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { data, error, refresh, db };
}
