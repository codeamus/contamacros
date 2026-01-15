// src/core/featureFlags/resolveFlags.ts
import {
     FREE_FLAGS,
     PREMIUM_FLAGS,
     type FeatureFlags,
} from "@/core/featureFlags/flags";

export type Plan = "free" | "premium";

export function resolveFlags(plan: Plan): FeatureFlags {
  return plan === "premium" ? PREMIUM_FLAGS : FREE_FLAGS;
}
