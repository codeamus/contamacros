// src/data/supabase/supabaseClient.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const supabaseUrl = extra.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = extra.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Esto te deja un error claro en logcat si vuelve a fallar
  throw new Error(
    "Missing Supabase env vars. Check app.config.ts + .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,

    // ✅ Requerido para mobile + `exchangeCodeForSession(code)`
    // (flujo OAuth PKCE).
    flowType: "pkce",

    // En mobile NO hay “URL redirect” como en web. Mejor dejarlo false.
    // Esto además evita comportamientos raros en Android release.
    detectSessionInUrl: false,
  },
});
