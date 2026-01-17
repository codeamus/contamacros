// src/presentation/auth/oauthGoogle.ts
import { AuthService } from "@/domain/services/authService";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

/**
 * Redirect para Expo Go (proxy) y para builds (scheme).
 * - Expo Go: https://auth.expo.io/@user/slug
 * - Build: contamacro://...
 */
export function getRedirectUri() {
  const scheme = Constants.expoConfig?.scheme ?? "contamacro";
  const isExpoGo = Constants.appOwnership === "expo";

  return AuthSession.makeRedirectUri({
    scheme,
    // Expo Go necesita proxy, builds no.
    useProxy: isExpoGo,
  });
}

function extractCodeFromUrl(url: string): string | null {
  try {
    const parsed = AuthSession.parse(url);
    const code = (parsed.queryParams?.code as string | undefined) ?? null;
    return code;
  } catch {
    return null;
  }
}

/**
 * Login con Google vía Supabase OAuth:
 * 1) Pedimos URL a Supabase (signInWithOAuth)
 * 2) Abrimos sesión en browser (openAuthSessionAsync)
 * 3) Leemos `code` del redirect
 * 4) exchangeCodeForSession
 */
export async function signInWithGoogleExpo(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const redirectTo = getRedirectUri();

  const oauth = await AuthService.signInWithGoogleNative(redirectTo);
  if (!oauth.ok || !oauth.url) {
    return {
      ok: false,
      message: oauth.message ?? "No se pudo iniciar Google.",
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(oauth.url, redirectTo);

  if (result.type === "cancel") {
    return { ok: false, message: "Inicio de sesión cancelado." };
  }

  if (result.type !== "success" || !result.url) {
    return { ok: false, message: "No se pudo completar el inicio de sesión." };
  }

  const code = extractCodeFromUrl(result.url);
  if (!code) {
    return { ok: false, message: "No se recibió el código de autorización." };
  }

  const ex = await AuthService.exchangeCodeForSession(code);
  if (!ex.ok) return { ok: false, message: ex.message ?? "Error de sesión." };

  return { ok: true };
}
