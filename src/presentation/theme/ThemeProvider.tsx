// src/presentation/theme/ThemeProvider.tsx
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { makeColors, ThemeMode } from "@/presentation/theme/colors";
import { makeTypography } from "@/presentation/theme/typography";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React, {
     createContext,
     useContext,
     useEffect,
     useMemo,
     useState,
} from "react";
import { useColorScheme } from "react-native";

SplashScreen.preventAutoHideAsync().catch(() => {});

type Theme = {
  mode: Exclude<ThemeMode, "system">;
  colors: ReturnType<typeof makeColors>;
  typography: ReturnType<typeof makeTypography>;
};

type ThemeContextValue = {
  theme: Theme;
  themeMode: ThemeMode; // Modo preferido (light/dark/system)
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [modePref, setModePref] = useState<ThemeMode>("system");

  const [fontsLoaded] = useFonts({
    // Lora
    "Lora-BoldItalic": require("assets/fonts/Lora-BoldItalic.ttf"),
    // Nunito
    "Nunito-Bold": require("assets/fonts/Nunito-Bold.ttf"),
    // Work Sans
    "WorkSans-Regular": require("assets/fonts/WorkSans-Regular.ttf"),
  });

  // Resuelve el modo final
  const resolvedMode: Exclude<ThemeMode, "system"> =
    modePref === "system" ? (system === "dark" ? "dark" : "light") : modePref;

  const theme = useMemo<Theme>(() => {
    return {
      mode: resolvedMode,
      colors: makeColors(resolvedMode),
      typography: makeTypography(),
    };
  }, [resolvedMode]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getString(StorageKeys.THEME_MODE);
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModePref(saved);
        }
      } finally {
        // Espera a fonts para evitar flash
        if (fontsLoaded) {
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    })();
  }, [fontsLoaded]);

  const setThemeMode = async (next: ThemeMode) => {
    setModePref(next);
    await storage.setString(StorageKeys.THEME_MODE, next);
  };

  const value = useMemo(
    () => ({ theme, themeMode: modePref, setThemeMode }),
    [theme, modePref],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeBootstrap() {
  // Este hook queda para futuros bootstraps (db init, auth init).
  // Por ahora, solo indica "ready" cuando se haya montado ThemeProvider + fonts.
  // La lógica real de ready está controlada por SplashScreen en ThemeProvider.
  return { isReady: true as const };
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
