// src/core/constants/tourSteps.ts

export type TourStepId =
  | "welcome"
  | "diary-tab"
  | "add-meal"
  | "scan-options"
  | "meal-type"
  | "finish";

export type TourScreen = "home" | "diary" | "add-food" | "finish";

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
    title: "Bienvenido a ContaMacros",
    description:
      "Aquí ves tu progreso diario de calorías y macros. Te mostramos las funciones clave para que empieces rápido.",
    spotlightPadding: 8,
  },
  {
    id: "diary-tab",
    screen: "home",
    title: "Tu Diario",
    description:
      'La pestaña "Diario" es donde registras todas tus comidas. Avanza para ir ahí.',
    navigateTo: "/(tabs)/diary",
  },
  {
    id: "add-meal",
    screen: "diary",
    title: "Agregar comida",
    description:
      'Toca "Añadir" para registrar una nueva comida. Puedes buscar por nombre, código de barras o foto con IA.',
    navigateTo: "/(tabs)/add-food",
    spotlightPadding: 4,
  },
  {
    id: "scan-options",
    screen: "add-food",
    title: "Escaneo automático",
    description:
      "Escanea el código de barras o usa IA con una foto para detectar los macros automáticamente. Sin escribir nada.",
    spotlightPadding: 6,
  },
  {
    id: "meal-type",
    screen: "add-food",
    title: "Tipo de comida",
    description:
      "Selecciona desayuno, almuerzo, cena o snack para organizar tu día y ver los totales por comida.",
    spotlightPadding: 6,
  },
  {
    id: "finish",
    screen: "finish",
    title: "¡Listo para empezar!",
    description:
      "Ya conoces lo esencial. Registra tus comidas, alcanza tus macros y cumple tus objetivos. ¡Buena suerte!",
  },
];
