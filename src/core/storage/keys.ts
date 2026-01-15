// src/core/storage/keys.ts
export const StorageKeys = {
  THEME_MODE: "theme_mode",
  SESSION_TOKEN: "session_token",
  USER_PROFILE: "user_profile",
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
