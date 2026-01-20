// app/_layout.tsx
import { AuthProvider, useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { ToastProvider } from "@/presentation/hooks/ui/useToast";
import { ThemeProvider } from "@/presentation/theme/ThemeProvider";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// ✅ Evita autohide globalmente (así NO aparece el warning del splash)
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore: puede ejecutarse 2 veces en dev / fast refresh
});

function AuthGate() {
  const { initializing, session, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const group = segments[0];
  const inAuth = group === "(auth)";
  const inOnboarding = group === "(onboarding)";
  const inTabs = group === "(tabs)";

  // Loader SOLO fuera de onboarding (para no tapar el flujo)
  const showLoader = initializing || (session && !profile && !inOnboarding);

  // ✅ Cuando la app está lista para renderizar UI real, escondemos el splash
  useEffect(() => {
    if (!showLoader) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [showLoader]);

  // ✅ Routing gate
  useEffect(() => {
    if (initializing) return;

    if (!session) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    // Si hay sesión y estás en auth, sácalo al onboarding (aunque profile aún no llegue)
    if (inAuth) {
      router.replace("/(onboarding)/goal");
      return;
    }

    // Si no hay profile todavía, en onboarding dejamos que renderice (sin loops)
    if (!profile) return;

    if (!profile.onboarding_completed) {
      if (!inOnboarding) router.replace("/(onboarding)/goal");
      return;
    }

    if (!inTabs) router.replace("/(tabs)");
  }, [initializing, session, profile, inAuth, inOnboarding, inTabs, router]);

  if (showLoader) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AuthGate />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
