// src/domain/mappers/profileMapper.ts
import type { ProfileDb } from "@/domain/models/profileDb";

export type Profile = Omit<ProfileDb, "weight_kg"> & {
  weight_kg: number | null;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapProfileDb(db: ProfileDb): Profile {
  return {
    ...db,
    weight_kg: toNumber(db.weight_kg),
  };
}
