// app/_layout.tsx
import { AuthProvider, useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { ToastProvider } from "@/presentation/hooks/ui/useToast";
import { ThemeProvider } from "@/presentation/theme/ThemeProvider";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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

  // ✅ FAILSAFE: Timeout de seguridad de 4 segundos
  // Fuerza el ocultamiento del splash después de 4 segundos máximo, pase lo que pase
  // Esto previene bloqueos causados por errores en hooks o librerías nativas
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      console.log(
        "[AuthGate] ⚠️ TIMEOUT DE SEGURIDAD: Forzando ocultamiento del splash después de 4s",
      );
      SplashScreen.hideAsync().catch((error) => {
        console.warn(
          "[AuthGate] Error al ocultar splash en timeout de seguridad:",
          error,
        );
      });
    }, 4000);

    return () => {
      clearTimeout(emergencyTimer);
    };
  }, []);

  // ✅ Cuando la app está lista para renderizar UI real, escondemos el splash
  // Usamos un pequeño delay para asegurar que el view controller esté listo
  useEffect(() => {
    if (!showLoader) {
      // Pequeño delay para asegurar que la navegación esté completa
      // Esto evita el error "No native splash screen registered"
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {
          // Ignorar errores silenciosamente si el splash ya fue ocultado
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showLoader]);

  // ✅ FORZAR OCULTAMIENTO cuando initializing cambia a false
  // Esto asegura que el splash se oculte incluso si showLoader sigue siendo true
  useEffect(() => {
    if (!initializing) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {
          // Ignorar errores silenciosamente
        });
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [initializing]);

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

    // Pantallas raíz permitidas fuera de (tabs): no redirigir a tabs
    const allowedRootScreens = ["smart-coach-pro", "recipe-detail"];
    if (!inTabs && !allowedRootScreens.includes(group)) {
      router.replace("/(tabs)");
    }
  }, [
    initializing,
    session,
    profile,
    inAuth,
    inOnboarding,
    inTabs,
    group,
    router,
  ]);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AuthGate />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
