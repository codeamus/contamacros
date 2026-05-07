// app.config.ts
import type { ConfigContext } from "@expo/config";
// @ts-expect-error - JSON import without assertion for compatibility
import appJson from "./app.json";

import dotenv from "dotenv";
import path from "path";

// 👇 carga .env de forma explícita (no dependas del cwd)
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

// Si usas profiles:
// dotenv.config({ path: path.resolve(__dirname, ".env.production") });

function required(v: string | undefined, name: string) {
  const value = (v ?? "").trim();
  if (!value) throw new Error(`[app.config] Missing env: ${name}`);
  return value;
}

export default ({ config }: ConfigContext) => ({
  ...appJson.expo,
  ...config,
  extra: {
    ...(appJson.expo.extra ?? {}),
    ...(config.extra ?? {}),
    // RevenueCat (NO commitear keys; se inyectan por env / EAS secrets)
    REVENUECAT_ANDROID_API_KEY: required(
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
      "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
    ),
    REVENUECAT_APPLE_API_KEY: required(
      process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
      "EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY",
    ),
    EXPO_PUBLIC_SUPABASE_URL: required(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      "EXPO_PUBLIC_SUPABASE_URL"
    ),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: required(
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    ),
    EXPO_PUBLIC_GEMINI_API_KEY_ANDROID: required(
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_ANDROID,
      "EXPO_PUBLIC_GEMINI_API_KEY_ANDROID"
    ),
    EXPO_PUBLIC_GEMINI_API_KEY_IOS: required(
      process.env.EXPO_PUBLIC_GEMINI_API_KEY_IOS,
      "EXPO_PUBLIC_GEMINI_API_KEY_IOS"
    ),
  },
});
