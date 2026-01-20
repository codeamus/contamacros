// src/domain/services/macroTargets.ts
export type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeMacroTargets(params: {
  calories: number; // daily_calorie_target
  weightKg: number;
}): MacroTargets {
  const calories = Math.round(params.calories);
  const weightKg = params.weightKg;

  // MVP: reglas por kg (gym-friendly)
  const proteinG = Math.round(weightKg * 2.0);
  const fatG = Math.round(weightKg * 0.8);

  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;

  // calorías restantes para carbs (no negativos)
  const remaining = Math.max(0, calories - proteinKcal - fatKcal);
  const carbsG = Math.round(remaining / 4);

  // clamps suaves por seguridad (evita resultados absurdos)
  const safeProtein = clamp(proteinG, 60, 260);
  const safeFat = clamp(fatG, 35, 160);
  const safeCarbs = clamp(carbsG, 0, 600);

  return {
    calories,
    proteinG: safeProtein,
    fatG: safeFat,
    carbsG: safeCarbs,
  };
}
