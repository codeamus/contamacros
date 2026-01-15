// src/presentation/state/profileStore.ts
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import type { UserProfile } from "@/domain/models/userProfile";
import { create } from "zustand";

type ProfileState = {
  profile: UserProfile | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => Promise<void>;
  clearProfile: () => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isHydrated: false,

  async hydrate() {
    const raw = await storage.getString(StorageKeys.USER_PROFILE);
    if (!raw) {
      set({ profile: null, isHydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as UserProfile;
      set({ profile: parsed, isHydrated: true });
    } catch {
      set({ profile: null, isHydrated: true });
    }
  },

  async setProfile(profile) {
    if (profile)
      await storage.setString(
        StorageKeys.USER_PROFILE,
        JSON.stringify(profile)
      );
    else await storage.remove(StorageKeys.USER_PROFILE);
    set({ profile });
  },

  async clearProfile() {
    await storage.remove(StorageKeys.USER_PROFILE);
    set({ profile: null });
  },
}));
