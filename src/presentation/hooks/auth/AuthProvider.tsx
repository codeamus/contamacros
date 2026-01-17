// src/presentation/hooks/auth/AuthProvider.tsx
import { supabase } from "@/data/supabase/supabaseClient";
import type { ProfileDb } from "@/domain/models/profileDb";
import { AuthService } from "@/domain/services/authService";
import type { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  initializing: boolean;
  session: Session | null;
  profile: ProfileDb | null;

  signUp: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; message?: string }>;

  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signInWithApple: () => Promise<{ ok: boolean; message?: string }>;

  signOut: () => Promise<void>;
  refreshProfile: () => Promise<ProfileDb | null>;

  updateProfile: (
    input: Partial<ProfileDb> & Record<string, any>,
  ) => Promise<{ ok: boolean; message?: string }>;
};

const Ctx = createContext<AuthState | null>(null);

const APP_SCHEME = "contamacro";

/**
 * En Expo Go: usamos el returnUrl por defecto (exp://.../--/auth/callback).
 * En build: usamos scheme (contamacro://auth/callback).
 *
 * Nota: evitamos `useProxy` porque tu versión de tipos no lo soporta.
 */
function getRedirectUri() {
  const isExpoGo = Constants.appOwnership === "expo";

  // OJO: en tu versión de types, `useProxy` puede no existir,
  // pero en runtime sí funciona. Por eso el cast.
  return AuthSession.makeRedirectUri({
    scheme: isExpoGo ? undefined : APP_SCHEME,
    path: "auth/callback",
    ...(isExpoGo ? ({ useProxy: true } as any) : {}),
  } as any);
}

function getParam(url: string, key: string) {
  // 1) query (?code=...)
  const qIndex = url.indexOf("?");
  if (qIndex >= 0) {
    const query = url.slice(qIndex + 1).split("#")[0];
    const params = new URLSearchParams(query);
    const v = params.get(key);
    if (v) return v;
  }

  // 2) hash (#code=...) por si viene en fragment
  const hIndex = url.indexOf("#");
  if (hIndex >= 0) {
    const hash = url.slice(hIndex + 1);
    const params = new URLSearchParams(hash);
    const v = params.get(key);
    if (v) return v;
  }

  return null;
}

function randomNonce(length = 32) {
  const chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  let result = "";
  for (let i = 0; i < length; i++)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

async function sha256(str: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, str);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileDb | null>(null);

  async function refreshProfile(): Promise<ProfileDb | null> {
    for (let i = 0; i < 8; i++) {
      const res = await AuthService.getMyProfile();
      if (res.ok && res.data) {
        setProfile(res.data);
        return res.data;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const last = await AuthService.getMyProfile();
    if (last.ok) {
      setProfile(last.data);
      return last.data;
    }
    return null;
  }

  useEffect(() => {
    let unsub: null | (() => void) = null;

    (async () => {
      const s = await AuthService.getSession();
      if (s.ok) setSession(s.data);
      if (s.ok && s.data) await refreshProfile();
      setInitializing(false);

      unsub = AuthService.onAuthStateChange(async (sess) => {
        setSession(sess);
        if (sess) await refreshProfile();
        else setProfile(null);
      });
    })();

    return () => unsub?.();
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      initializing,
      session,
      profile,

      signUp: async (email, password) => {
        const res = await AuthService.signUp(email, password);
        if (!res.ok) return { ok: false, message: res.message };

        const s = await AuthService.getSession();
        if (s.ok) setSession(s.data);

        await refreshProfile();
        return { ok: true };
      },

      signIn: async (email, password) => {
        const res = await AuthService.signIn(email, password);
        if (!res.ok) return { ok: false, message: res.message };
        setSession(res.data);
        await refreshProfile();
        return { ok: true };
      },

      // ✅ Google: Supabase -> WebBrowser -> exchange
      signInWithGoogle: async () => {
        try {
          const redirectTo = getRedirectUri();

          // 1) Pedimos a Supabase la URL OAuth
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
              skipBrowserRedirect: true, // CLAVE en Expo / RN
            },
          });

          if (error) {
            return { ok: false, message: error.message };
          }

          if (!data?.url) {
            return { ok: false, message: "No se generó URL OAuth." };
          }
          // 2) Abrimos el browser de autenticación
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectTo,
          );

          if (result.type !== "success" || !result.url) {
            // usuario canceló o cerró
            return { ok: false, message: undefined };
          }

          const url = result.url;

          // 3) Si Google/Supabase devuelve error
          const err =
            getParam(url, "error_description") ??
            getParam(url, "error") ??
            getParam(url, "message");

          if (err) {
            return {
              ok: false,
              message: decodeURIComponent(err),
            };
          }

          // 4) Flujo normal PKCE → viene ?code=
          const code = getParam(url, "code");
          if (code) {
            const { error: exErr } =
              await supabase.auth.exchangeCodeForSession(code);

            if (exErr) {
              return { ok: false, message: exErr.message };
            }

            const s = await AuthService.getSession();
            if (s.ok) setSession(s.data);

            await refreshProfile();
            return { ok: true };
          }

          // 5) Fallback: a veces viene implicit flow (#access_token)
          const accessToken = getParam(url, "access_token");
          const refreshToken = getParam(url, "refresh_token");

          if (accessToken) {
            const { data: sessData, error: setErr } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken ?? "",
              });

            if (setErr) {
              return { ok: false, message: setErr.message };
            }

            setSession(sessData.session ?? null);
            await refreshProfile();
            return { ok: true };
          }

          // 6) Nada vino → algo raro pasó
          return {
            ok: false,
            message: "No se recibió el código ni token de autenticación.",
          };
        } catch (e: any) {
          return {
            ok: false,
            message: e?.message ?? "No pudimos iniciar con Google.",
          };
        }
      },

      signInWithApple: async () => {
        try {
          if (Platform.OS !== "ios") {
            return { ok: false, message: "Apple solo está disponible en iOS." };
          }

          const available = await AppleAuthentication.isAvailableAsync();
          if (!available) {
            return {
              ok: false,
              message: "Apple Sign-In no está disponible en este dispositivo.",
            };
          }

          const nonce = randomNonce(32);
          const hashedNonce = await sha256(nonce);

          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });

          const identityToken = credential.identityToken;
          if (!identityToken) {
            return {
              ok: false,
              message: "No pudimos obtener el token de Apple.",
            };
          }

          const res = await AuthService.signInWithAppleIdToken(
            identityToken,
            nonce,
          );
          if (!res.ok) {
            return {
              ok: false,
              message: res.message ?? "No pudimos iniciar con Apple.",
            };
          }

          const s = await AuthService.getSession();
          if (s.ok) setSession(s.data);

          await refreshProfile();
          return { ok: true };
        } catch (e: any) {
          if (
            e?.code === "ERR_REQUEST_CANCELED" ||
            e?.code === "ERR_CANCELED"
          ) {
            return { ok: false, message: undefined };
          }
          return {
            ok: false,
            message: e?.message ?? "No pudimos iniciar con Apple.",
          };
        }
      },

      signOut: async () => {
        await AuthService.signOut();
        setSession(null);
        setProfile(null);
      },

      refreshProfile,

      updateProfile: async (input) => {
        const res = await AuthService.updateMyProfile(input as any);
        if (!res.ok) return { ok: false, message: res.message };
        setProfile(res.data);
        return { ok: true };
      },
    };
  }, [initializing, session, profile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
