// src/presentation/auth/oauthRedirect.ts
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";

const FALLBACK_SCHEME = "contamacro";

/**
 * Redirect para Expo Go (proxy) y para builds (scheme).
 * - Expo Go: exp://....exp.direct/--/auth/callback
 * - Build:  contamacro://auth/callback
 */
export function getRedirectUri() {
  const scheme =
    Constants.expoConfig?.scheme ||
    Constants.expoConfig?.ios?.bundleIdentifier || // no siempre sirve, pero ayuda
    FALLBACK_SCHEME;

  // En Expo Go normalmente conviene proxy=true (te da exp.direct)
  // En builds, proxy=false usa scheme.
  const useProxy = Constants.appOwnership === "expo";

  return AuthSession.makeRedirectUri({
    scheme: useProxy ? undefined : scheme,
    path: "auth/callback",
    useProxy,
  });
}
