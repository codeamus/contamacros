// src/core/storage/keys.ts
export const StorageKeys = {
  THEME_MODE: "theme_mode",
  SESSION_TOKEN: "session_token",
  USER_PROFILE: "user_profile",
  PENDING_PROFILE_SYNC: "pending_profile_sync",
  SEARCH_HISTORY: "search_history",
  AI_SCAN_DAILY_LIMIT: "ai_scan_daily_limit",
  FAVORITES_CACHE: "favorites_cache",
  RECENT_FOODS: "recent_foods",
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
