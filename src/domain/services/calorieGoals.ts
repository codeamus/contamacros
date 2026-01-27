// src/domain/services/calorieGoals.ts
export type Gender = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "high"
  | "very_high";

export type GoalType = "deficit" | "maintenance" | "surplus";

/**
 * Factores de actividad (ver docs/calorie-goals.md)
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

/**
 * Mifflin–St Jeor (ver docs/calorie-goals.md)
 */
export function calcBmr(params: {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const { gender, weightKg, heightCm, ageYears } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === "male" ? base + 5 : base - 161;
}

export function calcTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

/**
 * Ajustes de objetivo (por defecto)
 * - deficit: -15%
 * - maintenance: 0%
 * - surplus: +10%
 */
export const DEFAULT_GOAL_ADJUSTMENT: Record<GoalType, number> = {
  deficit: -0.15,
  maintenance: 0,
  surplus: 0.1,
};

export function calcDailyTarget(params: {
  tdee: number;
  goalType: GoalType;
  goalAdjustment?: number; // opcional para premium / avanzado
}): number {
  const { tdee, goalType } = params;
  const adj =
    typeof params.goalAdjustment === "number"
      ? params.goalAdjustment
      : DEFAULT_GOAL_ADJUSTMENT[goalType];
  return tdee * (1 + adj);
}

// -------------------------------
// calculateCalorieGoal (PURE)
// -------------------------------

export type UserProfileForGoal = {
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalAdjustment?: number; // opcional
};

export type CalorieGoalResult = {
  ageYears: number;
  bmr: number;
  tdee: number;
  activityFactor: number;

  goalType: GoalType;
  goalAdjustment: number; // persistible
  dailyCalorieTarget: number; // persistible (redondeado)

  breakdown: {
    baseTdeeRounded: number;
    delta: number;
  };
};

export type CalculateGoalOptions = {
  roundTo?: 1 | 5 | 10 | 25 | 50 | 100;
  /**
   * Si quieres bloquear opciones (ej: -20% solo Premium)
   * pásalo desde la capa de app según subscription.
   */
  allowedDeficitAdjustments?: number[]; // ej: [-0.1, -0.15, -0.2]
  allowedSurplusAdjustments?: number[]; // ej: [0.05, 0.1, 0.15]
};

function isValidYyyyMmDd(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const parts = s.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

function calcAgeYears(birthDate: string, now = new Date()): number {
  const parts = birthDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const bd = new Date(y, m - 1, d);

  let age = now.getFullYear() - bd.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() >= bd.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function assertFinitePositive(name: string, n: number) {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}

function assertInRange(name: string, n: number, min: number, max: number) {
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

function enforceAllowedAdjustments(
  goalType: GoalType,
  adj: number,
  opts?: CalculateGoalOptions,
) {
  if (goalType === "deficit" && opts?.allowedDeficitAdjustments?.length) {
    if (!opts.allowedDeficitAdjustments.includes(adj)) {
      throw new Error(`goalAdjustment ${adj} is not allowed for deficit`);
    }
  }
  if (goalType === "surplus" && opts?.allowedSurplusAdjustments?.length) {
    if (!opts.allowedSurplusAdjustments.includes(adj)) {
      throw new Error(`goalAdjustment ${adj} is not allowed for surplus`);
    }
  }
}

/**
 * Orquesta el cálculo completo en una sola llamada (PURE).
 * - No toca DB
 * - No muta el profile
 * - Retorna todo lo necesario para UI y persistencia
 */
export function calculateCalorieGoal(
  profile: UserProfileForGoal,
  options: CalculateGoalOptions = {},
): CalorieGoalResult {
  const roundTo = options.roundTo ?? 10;

  // Validaciones mínimas
  if (!profile.gender) throw new Error("gender is required");
  if (!isValidYyyyMmDd(profile.birthDate)) {
    throw new Error("birthDate must be YYYY-MM-DD (valid date)");
  }

  assertFinitePositive("heightCm", profile.heightCm);
  assertFinitePositive("weightKg", profile.weightKg);

  // Guardrails razonables
  assertInRange("heightCm", profile.heightCm, 100, 250);
  assertInRange("weightKg", profile.weightKg, 30, 250);

  const ageYears = calcAgeYears(profile.birthDate);
  assertInRange("ageYears", ageYears, 13, 90);

  const bmr = calcBmr({
    gender: profile.gender,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    ageYears,
  });

  const tdee = calcTdee(bmr, profile.activityLevel);
  const activityFactor = ACTIVITY_FACTORS[profile.activityLevel];

  const goalAdjustment =
    typeof profile.goalAdjustment === "number"
      ? profile.goalAdjustment
      : DEFAULT_GOAL_ADJUSTMENT[profile.goalType];

  // Rango básico por tipo
  if (profile.goalType === "deficit") {
    assertInRange("goalAdjustment(deficit)", goalAdjustment, -0.3, 0);
  } else if (profile.goalType === "maintenance") {
    assertInRange("goalAdjustment(maintenance)", goalAdjustment, 0, 0);
  } else {
    assertInRange("goalAdjustment(surplus)", goalAdjustment, 0, 0.3);
  }

  enforceAllowedAdjustments(profile.goalType, goalAdjustment, options);

  const rawTarget = calcDailyTarget({
    tdee,
    goalType: profile.goalType,
    goalAdjustment,
  });

  const tdeeRounded = roundToStep(tdee, roundTo);
  const targetRounded = roundToStep(rawTarget, roundTo);

  return {
    ageYears,
    bmr,
    tdee,
    activityFactor,
    goalType: profile.goalType,
    goalAdjustment,
    dailyCalorieTarget: targetRounded,
    breakdown: {
      baseTdeeRounded: tdeeRounded,
      delta: targetRounded - tdeeRounded,
    },
  };
}

// ---------------------------------------------------------------------------
// Única fuente de verdad para cambio de objetivo en Settings
// ---------------------------------------------------------------------------

export type GoalDb = "deficit" | "maintain" | "surplus";

function goalDbToGoalType(db: GoalDb): GoalType {
  if (db === "maintain") return "maintenance";
  return db as GoalType;
}

function ensureNumber(v: unknown, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Perfil base: solo datos de cuerpo y actividad. Sin daily_calorie_target ni goal_adjustment.
 */
export type CleanProfileForGoal = {
  gender?: string | null;
  birth_date?: string | null;
  activity_level?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
};

/**
 * Única fuente de verdad para recalcular calorías al cambiar objetivo en Settings.
 * Usa solo: gender, birth_date, height_cm, weight_kg, activity_level.
 * goalAdjustment sale siempre de DEFAULT_GOAL_ADJUSTMENT[newGoalDb].
 * Ej.: 80kg, 175cm, 30a, moderado → Mantenimiento ~2710 kcal, Déficit ~2300 kcal.
 */
export function calculateCalorieGoalFromProfile(
  profile: CleanProfileForGoal,
  newGoalDb: GoalDb,
): CalorieGoalResult {
  const gender =
    profile.gender === "male" || profile.gender === "female"
      ? profile.gender
      : "male";
  const birthDate =
    typeof profile.birth_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(profile.birth_date)
      ? profile.birth_date
      : "1990-01-01";
  const heightCm = ensureNumber(profile.height_cm, 170);
  const weightKg = ensureNumber(profile.weight_kg, 70);
  const activityLevel =
    ["sedentary", "light", "moderate", "high", "very_high"].includes(
      String(profile.activity_level ?? ""),
    )
      ? (profile.activity_level as ActivityLevel)
      : "moderate";

  const goalType = goalDbToGoalType(newGoalDb);

  return calculateCalorieGoal(
    {
      gender: gender as Gender,
      birthDate,
      heightCm,
      weightKg,
      activityLevel,
      goalType,
    },
    {
      roundTo: 10,
      allowedDeficitAdjustments: [-0.1, -0.15],
      allowedSurplusAdjustments: [0.05, 0.1, 0.15],
    },
  );
}
