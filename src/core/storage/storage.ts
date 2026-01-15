// src/core/storage/storage.ts
import type { StorageKey } from "@/core/storage/keys";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  async getString(key: StorageKey): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setString(key: StorageKey, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async remove(key: StorageKey): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.clear();
  },
};
