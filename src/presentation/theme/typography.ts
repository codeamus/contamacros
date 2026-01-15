// src/presentation/theme/typography.ts
import { Platform } from "react-native";

export type Typography = {
  title: any;
  subtitle: any;
  body: any;
};

export function makeTypography(): Typography {
  // NOTA: Aquí solo definimos estilos. Las fuentes se cargan con Expo Font en ThemeProvider.
  // Títulos: Lora italic + bold
  // Subtítulo: Nunito bold
  // Párrafos: Work Sans regular
  const titleFont = Platform.select({
    ios: "Lora-BoldItalic",
    android: "Lora-BoldItalic",
    default: "Lora-BoldItalic",
  });

  const subtitleFont = Platform.select({
    ios: "Nunito-Bold",
    android: "Nunito-Bold",
    default: "Nunito-Bold",
  });

  const bodyFont = Platform.select({
    ios: "WorkSans-Regular",
    android: "WorkSans-Regular",
    default: "WorkSans-Regular",
  });

  return {
    title: {
      fontFamily: titleFont,
      fontSize: 28,
      lineHeight: 34,
    },
    subtitle: {
      fontFamily: subtitleFont,
      fontSize: 16,
      lineHeight: 22,
    },
    body: {
      fontFamily: bodyFont,
      fontSize: 14,
      lineHeight: 20,
    },
  };
}
