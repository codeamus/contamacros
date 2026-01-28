// src/presentation/state/smartCoachRecommendationStore.ts
import type {
    CalorieRecommendation,
    MacroRecommendation,
    SmartCoachRecommendation
} from "@/domain/models/smartCoach";
import { create } from "zustand";

export type FoodRecommendation = MacroRecommendation | CalorieRecommendation;

type SmartCoachRecommendationState = {
  /** Recomendación (comida o ejercicio) para la pantalla Smart Coach Pro */
  recommendation: SmartCoachRecommendation | null;
  /** Si es > 0, abrir pantalla en modo "éxito" (actividad compensó el balance) sin recomendación */
  successCaloriesBurned: number | null;
  setRecommendation: (r: SmartCoachRecommendation | null) => void;
  /** Abre la pantalla mostrando el mensaje de éxito con calorías quemadas */
  openSuccessScreen: (caloriesBurned: number) => void;
  clearRecommendation: () => void;
};

export const useSmartCoachRecommendationStore = create<SmartCoachRecommendationState>((set) => ({
  recommendation: null,
  successCaloriesBurned: null,
  setRecommendation: (recommendation) => set({ recommendation, successCaloriesBurned: null }),
  openSuccessScreen: (caloriesBurned) => set({ recommendation: null, successCaloriesBurned: caloriesBurned }),
  clearRecommendation: () => set({ recommendation: null, successCaloriesBurned: null }),
}));
