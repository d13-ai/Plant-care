/**
 * In-memory stand-in for @react-native-async-storage/async-storage.
 *
 * The e2e harness runs the app's real Supabase code under Node, where the
 * native module doesn't exist. Only the handful of methods the app and
 * supabase-js actually call are implemented.
 */
const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
};

export default AsyncStorage;
