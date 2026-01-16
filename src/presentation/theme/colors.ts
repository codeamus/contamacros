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

// src/presentation/theme/colors.ts
export function makeColors(mode: Exclude<ThemeMode, "system">): AppColors {
  if (mode === "dark") {
    return {
      background: palette.avocadoSkin,
      surface: "#163126",
      border: "#244235",

      textPrimary: palette.avocadoCream,
      textSecondary: "#D6D8C9",

      cta: palette.avocadoSeed,
      onCta: palette.avocadoCream,

      brand: palette.avocadoGreen,
    };
  }

  // ✅ light (más descansado)
  return {
    background: palette.avocadoCream, // ✅ antes: avocadoGreen
    surface: palette.white,           // ✅ cards más “limpias”
    border: "#E1E5D3",

    textPrimary: palette.avocadoSkin,
    textSecondary: "#2C4B40",

    cta: palette.avocadoSeed,
    onCta: palette.avocadoCream,

    brand: palette.avocadoGreen,
  };
}

