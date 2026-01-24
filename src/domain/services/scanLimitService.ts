// src/domain/services/scanLimitService.ts
import { storage } from "@/core/storage/storage";
import { StorageKeys } from "@/core/storage/keys";

const DAILY_LIMIT = 3;

type ScanLimitData = {
  date: string; // YYYY-MM-DD
  count: number;
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 */
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene el contador de escaneos del día actual
 */
export async function getTodayScanCount(): Promise<number> {
  try {
    const data = await storage.getJson<ScanLimitData>(StorageKeys.AI_SCAN_DAILY_LIMIT);
    
    if (!data) {
      return 0;
    }

    const today = getTodayString();
    
    // Si la fecha guardada no es hoy, reiniciar contador
    if (data.date !== today) {
      return 0;
    }

    return data.count || 0;
  } catch (error) {
    console.error("[scanLimitService] Error al obtener contador:", error);
    return 0;
  }
}

/**
 * Incrementa el contador de escaneos del día actual
 */
export async function incrementScanCount(): Promise<void> {
  try {
    const today = getTodayString();
    const currentCount = await getTodayScanCount();
    
    const newData: ScanLimitData = {
      date: today,
      count: currentCount + 1,
    };

    await storage.setJson(StorageKeys.AI_SCAN_DAILY_LIMIT, newData);
    console.log(`[scanLimitService] ✅ Contador incrementado: ${newData.count}/${DAILY_LIMIT}`);
  } catch (error) {
    console.error("[scanLimitService] Error al incrementar contador:", error);
  }
}

/**
 * Verifica si el usuario puede realizar un escaneo
 * @returns true si puede escanear, false si alcanzó el límite
 */
export async function canScanToday(): Promise<boolean> {
  const count = await getTodayScanCount();
  return count < DAILY_LIMIT;
}

/**
 * Obtiene el límite diario configurado
 */
export function getDailyLimit(): number {
  return DAILY_LIMIT;
}

/**
 * Obtiene los escaneos restantes del día
 */
export async function getRemainingScans(): Promise<number> {
  const count = await getTodayScanCount();
  return Math.max(0, DAILY_LIMIT - count);
}
