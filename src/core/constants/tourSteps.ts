// src/core/constants/tourSteps.ts

export type TourStepId =
  | "welcome"
  | "add-meal"
  | "scan-options";

export type TourScreen = "home" | "diary" | "add-food";

export type TourStepDef = {
  id: TourStepId;
  screen: TourScreen;
  title: string;
  description: string;
  /** Ruta a navegar automáticamente cuando el usuario avanza DESDE este paso */
  navigateTo?: string;
  /** Padding extra alrededor del elemento destacado */
  spotlightPadding?: number;
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: "welcome",
    screen: "home",
    title: "Tu progreso, de un vistazo",
    description:
      "Acá ves tus calorías y macros del día en tiempo real. Una sola pantalla para saber cómo vas.",
    navigateTo: "/(tabs)/diary",
    spotlightPadding: 8,
  },
  {
    id: "add-meal",
    screen: "diary",
    title: "Registra lo que comés",
    description:
      'Toca "Añadir" para agregar una comida. Busca por nombre o usá el escaneo — es más rápido.',
    navigateTo: "/(tabs)/add-food",
    spotlightPadding: 4,
  },
  {
    id: "scan-options",
    screen: "add-food",
    title: "Escaneo con código o IA",
    description:
      "Lee el código de barras del producto o sacá una foto del plato y la IA detecta los macros sola.",
    spotlightPadding: 6,
  },
];
