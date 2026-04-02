// src/domain/services/weightService.ts
import { storage } from "@/core/storage/storage";
import { StorageKeys } from "@/core/storage/keys";

export type WeightEntry = {
  date: string; // YYYY-MM-DD
  kg: number;
};

export const WeightService = {
  async getAll(): Promise<WeightEntry[]> {
    const data = await storage.getJson<WeightEntry[]>(StorageKeys.WEIGHT_LOGS);
    return data ?? [];
  },

  async save(entry: WeightEntry): Promise<void> {
    const existing = await WeightService.getAll();
    // Reemplazar si ya existe un registro para esa fecha
    const filtered = existing.filter((e) => e.date !== entry.date);
    const updated = [...filtered, entry].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    await storage.setJson(StorageKeys.WEIGHT_LOGS, updated);
  },

  async getRange(startDate: string, endDate: string): Promise<WeightEntry[]> {
    const all = await WeightService.getAll();
    return all.filter((e) => e.date >= startDate && e.date <= endDate);
  },

  async getLatest(): Promise<WeightEntry | null> {
    const all = await WeightService.getAll();
    if (all.length === 0) return null;
    return all[all.length - 1] ?? null;
  },
};
