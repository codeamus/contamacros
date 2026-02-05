// app.config.ts
import type { ConfigContext } from "@expo/config";
import "dotenv/config";
import appJson from "./app.json";

function required(v: string | undefined, name: string) {
  const value = (v ?? "").trim();
  if (!value) throw new Error(`[app.config] Missing env: ${name}`);
  return value;
}

export default ({ config }: ConfigContext) => ({
  // base: tu app.json
  ...appJson.expo,
  // preserve lo que Expo entregue
  ...config,
  extra: {
    ...(appJson.expo.extra ?? {}),
    ...(config.extra ?? {}),
    EXPO_PUBLIC_SUPABASE_URL: required(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      "EXPO_PUBLIC_SUPABASE_URL"
    ),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: required(
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    ),
    EXPO_PUBLIC_GEMINI_API_KEY: required(
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      "EXPO_PUBLIC_GEMINI_API_KEY"
    )
  }
});
