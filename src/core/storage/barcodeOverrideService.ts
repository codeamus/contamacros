import { StorageKeys } from "./keys";
import { storage } from "./storage";

async function getOverrides(): Promise<Set<string>> {
  const list = await storage.getJson<string[]>(StorageKeys.BARCODE_OVERRIDES);
  return new Set(list ?? []);
}

async function add(barcode: string): Promise<void> {
  const set = await getOverrides();
  set.add(barcode);
  await storage.setJson(StorageKeys.BARCODE_OVERRIDES, Array.from(set));
}

async function has(barcode: string): Promise<boolean> {
  const set = await getOverrides();
  return set.has(barcode);
}

export const barcodeOverrideService = { add, has };
