// src/presentation/state/authStore.ts
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { create } from "zustand";

type AuthState = {
  token: string | null;
  isHydrated: boolean;
  setToken: (token: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isHydrated: false,

  async hydrate() {
    const token = await storage.getString(StorageKeys.SESSION_TOKEN);
    set({ token, isHydrated: true });
  },

  async setToken(token) {
    if (token) await storage.setString(StorageKeys.SESSION_TOKEN, token);
    else await storage.remove(StorageKeys.SESSION_TOKEN);
    set({ token });
  },

  async logout() {
    await storage.remove(StorageKeys.SESSION_TOKEN);
    set({ token: null });
  },
}));
