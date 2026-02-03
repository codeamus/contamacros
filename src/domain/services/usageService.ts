// src/domain/services/usageService.ts
import { supabase } from "@/data/supabase/supabaseClient";

export type UserUsageStats = {
  user_id: string;
  daily_scan_count: number;
  last_scan_date: string;
  total_ai_scans: number;
  updated_at: string;
};

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export const UsageService = {
  /**
   * Obtiene las estadísticas de uso del usuario actual
   */
  async getUsageStats(): Promise<ServiceResult<UserUsageStats | null>> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return { ok: false, message: "No hay sesión activa" };

      const { data, error } = await supabase
        .from("user_usage_stats")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[UsageService] Error fetching stats:", error);
        return { ok: false, message: error.message, code: error.code };
      }

      if (!data) {
        console.log("[UsageService] No stats found, initializing for user:", userId);
        // Inicializar si no existe
        return this.initializeStats(userId);
      }

      // Verificar si hay que resetear el contador diario
      const today = new Date().toISOString().split("T")[0];
      if (data.last_scan_date !== today) {
        const { data: updatedData, error: updateError } = await supabase
          .from("user_usage_stats")
          .update({
            daily_scan_count: 0,
            last_scan_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select("*")
          .single();

        if (updateError) return { ok: false, message: updateError.message };
        return { ok: true, data: updatedData as UserUsageStats };
      }

      return { ok: true, data: data as UserUsageStats };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  },

  /**
   * Inicializa las estadísticas para un nuevo usuario
   */
  async initializeStats(userId: string): Promise<ServiceResult<UserUsageStats>> {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("user_usage_stats")
      .insert({
        user_id: userId,
        daily_scan_count: 0,
        last_scan_date: today,
        total_ai_scans: 0,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[UsageService] Error initializing stats:", error);
      return { ok: false, message: error.message };
    }
    console.log("[UsageService] Stats initialized successfully");
    return { ok: true, data: data as UserUsageStats };
  },

  /**
   * Incrementa el contador de escaneos de código de barras
   */
  async incrementScanCount(): Promise<ServiceResult<void>> {
    const statsRes = await this.getUsageStats();
    if (!statsRes.ok || !statsRes.data) return statsRes as any;

    const { error } = await supabase
      .from("user_usage_stats")
      .update({
        daily_scan_count: statsRes.data.daily_scan_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", statsRes.data.user_id);

    if (error) {
      console.error("[UsageService] Error incrementing scan count:", error);
      return { ok: false, message: error.message };
    }
    console.log("[UsageService] Scan count incremented:", statsRes.data.daily_scan_count + 1);
    return { ok: true, data: undefined };
  },

  /**
   * Incrementa el contador total de escaneos IA
   */
  async incrementAiScanCount(): Promise<ServiceResult<void>> {
    const statsRes = await this.getUsageStats();
    if (!statsRes.ok || !statsRes.data) return statsRes as any;

    const { error } = await supabase
      .from("user_usage_stats")
      .update({
        total_ai_scans: statsRes.data.total_ai_scans + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", statsRes.data.user_id);

    if (error) {
      console.error("[UsageService] Error incrementing AI scan count:", error);
      return { ok: false, message: error.message };
    }
    console.log("[UsageService] AI scan count incremented:", statsRes.data.total_ai_scans + 1);
    return { ok: true, data: undefined };
  },
};
