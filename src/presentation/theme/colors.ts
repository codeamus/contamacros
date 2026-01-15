// src/presentation/theme/colors.ts
export const palette = {
  avocadoGreen: "#22C55E", // fondo principal (brand)
  avocadoSkin: "#1B3A2F", // texto fuerte / contraste orgánico
  avocadoCream: "#F6F7EB", // superficies claras (cards)
  avocadoSeed: "#7A4A2E", // CTA / destacado

  // Neutrales auxiliares (derivados, no "principales" de la marca)
  white: "#FFFFFF",
  black: "#000000",
};

export type ThemeMode = "light" | "dark" | "system";

export type AppColors = {
  background: string;
  surface: string;
  border: string;

  textPrimary: string;
  textSecondary: string;

  cta: string;
  onCta: string;

  brand: string;
};

export function makeColors(mode: Exclude<ThemeMode, "system">): AppColors {
  if (mode === "dark") {
    return {
      background: palette.avocadoSkin,
      surface: "#163126", // un poco más claro que background
      border: "#244235",

      textPrimary: palette.avocadoCream,
      textSecondary: "#D6D8C9",

      cta: palette.avocadoSeed,
      onCta: palette.avocadoCream,

      brand: palette.avocadoGreen,
    };
  }

  // light
  return {
    background: palette.avocadoGreen,
    surface: palette.avocadoCream,
    border: "#D8DBC9",

    textPrimary: palette.avocadoSkin,
    textSecondary: "#2C4B40",

    cta: palette.avocadoSeed,
    onCta: palette.avocadoCream,

    brand: palette.avocadoGreen,
  };
}
