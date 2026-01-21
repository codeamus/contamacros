// src/domain/services/gamificationService.ts
import { supabase } from "@/data/supabase/supabaseClient";

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export type UserStats = {
  id: string;
  user_id: string;
  xp_points: number;
  level: number;
  daily_streak: number;
  last_activity_date: string | null;
  total_foods_contributed: number;
  created_at: string;
  updated_at: string;
};

export type UserAchievement = {
  id: string;
  user_id: string;
  achievement_type: string;
  unlocked_at: string;
  metadata?: Record<string, any>;
};

export type LeaderboardEntry = {
  user_id: string;
  full_name: string | null;
  email: string;
  xp_points: number;
  level: number;
  daily_streak: number;
  rank: number;
  is_premium?: boolean;
};

async function getUid(): Promise<RepoResult<string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false, message: error.message, code: error.code };
  const uid = data.session?.user?.id;
  if (!uid) return { ok: false, message: "No hay sesión activa." };
  return { ok: true, data: uid };
}

function calculateLevel(xp: number): number {
  // Fórmula: nivel = floor(sqrt(xp / 100))
  // Ejemplo: 0-99 XP = nivel 0, 100-399 XP = nivel 1, 400-899 XP = nivel 2, etc.
  return Math.floor(Math.sqrt(xp / 100));
}

/**
 * Obtiene el rango del usuario basado en su XP
 */
export function getUserRank(xp: number): {
  name: string;
  emoji: string;
  minXP: number;
  maxXP: number;
} {
  if (xp >= 5000) {
    return { name: "Master Pro", emoji: "👑", minXP: 5000, maxXP: Infinity };
  } else if (xp >= 2001) {
    return { name: "Atleta", emoji: "💪", minXP: 2001, maxXP: 4999 };
  } else if (xp >= 501) {
    return { name: "Entusiasta", emoji: "🥗", minXP: 501, maxXP: 2000 };
  } else {
    return { name: "Novato", emoji: "🥚", minXP: 0, maxXP: 500 };
  }
}

function xpForNextLevel(currentLevel: number): number {
  // XP necesario para el siguiente nivel
  const nextLevel = currentLevel + 1;
  return nextLevel * nextLevel * 100;
}

function xpForCurrentLevel(level: number): number {
  // XP necesario para el nivel actual
  return level * level * 100;
}

/**
 * Servicio de gamificación para manejar XP, streaks y achievements
 */
export const GamificationService = {
  /**
   * Obtiene o crea las estadísticas del usuario
   */
  async getUserStats(): Promise<RepoResult<UserStats>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Intentar obtener stats existentes
      const { data: existing, error: fetchError } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = no rows returned, que es esperado si no existe
        return { ok: false, message: fetchError.message, code: fetchError.code };
      }

      if (existing) {
        return { ok: true, data: existing as UserStats };
      }

      // Crear stats iniciales si no existen
      const { data: newStats, error: createError } = await supabase
        .from("user_stats")
        .insert({
          user_id: uid,
          xp_points: 0,
          level: 0,
          daily_streak: 0,
          last_activity_date: null,
          total_foods_contributed: 0,
        })
        .select("*")
        .maybeSingle();

      if (createError) {
        return { ok: false, message: createError.message, code: createError.code };
      }

      if (!newStats) {
        return { ok: false, message: "No se pudieron crear las estadísticas." };
      }

      return { ok: true, data: newStats as UserStats };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener estadísticas",
      };
    }
  },

  /**
   * Añade XP al usuario y actualiza el nivel
   * Retorna información sobre si el usuario subió de rango
   */
  async addXP(amount: number, reason: string): Promise<RepoResult<{ stats: UserStats; rankUp: boolean; newRank: ReturnType<typeof getUserRank> | null }>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Obtener stats actuales
      const statsResult = await this.getUserStats();
      if (!statsResult.ok) return statsResult;

      const currentStats = statsResult.data;
      const oldRank = getUserRank(currentStats.xp_points);
      const newXP = currentStats.xp_points + amount;
      const newLevel = calculateLevel(newXP);
      const newRank = getUserRank(newXP);
      const rankUp = oldRank.name !== newRank.name;

      // Actualizar stats
      const { data: updated, error } = await supabase
        .from("user_stats")
        .update({
          xp_points: newXP,
          level: newLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid)
        .select("*")
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      if (!updated) {
        return { ok: false, message: "No se pudo actualizar las estadísticas." };
      }

      console.log(`[Gamification] +${amount} XP (${reason}). Total: ${newXP} XP, Nivel: ${newLevel}`);
      if (rankUp) {
        console.log(`[Gamification] 🎉 ¡Subió de rango! De ${oldRank.name} a ${newRank.name}`);
      }

      return {
        ok: true,
        data: {
          stats: updated as UserStats,
          rankUp,
          newRank: rankUp ? newRank : null,
        },
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al añadir XP",
      };
    }
  },

  /**
   * Registra un aporte de alimento (creación de generic_food)
   * Añade +50 XP y actualiza el contador de alimentos contribuidos
   */
  async recordFoodContribution(): Promise<RepoResult<UserStats>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Obtener stats actuales
      const statsResult = await this.getUserStats();
      if (!statsResult.ok) return statsResult;

      const currentStats = statsResult.data;
      const newXP = currentStats.xp_points + 50;
      const newLevel = calculateLevel(newXP);

      // Actualizar stats
      const { data: updated, error } = await supabase
        .from("user_stats")
        .update({
          xp_points: newXP,
          level: newLevel,
          total_foods_contributed: currentStats.total_foods_contributed + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid)
        .select("*")
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      if (!updated) {
        return { ok: false, message: "No se pudo actualizar las estadísticas." };
      }

      // Verificar si desbloquea achievement "Primer Aporte"
      if (currentStats.total_foods_contributed === 0) {
        await this.unlockAchievement("first_contribution");
      }

      // Verificar si desbloquea achievement "Chef de la Comunidad" (10+ aportes)
      if (currentStats.total_foods_contributed + 1 === 10) {
        await this.unlockAchievement("community_chef");
      }

      const oldRank = getUserRank(currentStats.xp_points);
      const newRank = getUserRank(newXP);
      const rankUp = oldRank.name !== newRank.name;

      console.log(`[Gamification] +50 XP por aporte. Total: ${newXP} XP, Nivel: ${newLevel}`);
      if (rankUp) {
        console.log(`[Gamification] 🎉 ¡Subió de rango! De ${oldRank.name} a ${newRank.name}`);
      }

      return { ok: true, data: updated as UserStats };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al registrar aporte",
      };
    }
  },

  /**
   * Registra un registro diario (primera comida del día)
   * Añade +10 XP y actualiza la racha diaria
   */
  async recordDailyLog(day: string): Promise<RepoResult<UserStats>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Obtener stats actuales
      const statsResult = await this.getUserStats();
      if (!statsResult.ok) return statsResult;

      const currentStats = statsResult.data;
      const today = day; // YYYY-MM-DD

      // Verificar si es el primer registro del día
      // (esto se debe llamar solo cuando se crea el primer food_log del día)
      let newStreak = currentStats.daily_streak;
      let isConsecutive = false;

      if (currentStats.last_activity_date) {
        const lastDate = new Date(currentStats.last_activity_date);
        const todayDate = new Date(today);
        const yesterday = new Date(todayDate);
        yesterday.setDate(yesterday.getDate() - 1);

        // Verificar si la última actividad fue ayer (consecutivo)
        if (
          lastDate.getFullYear() === yesterday.getFullYear() &&
          lastDate.getMonth() === yesterday.getMonth() &&
          lastDate.getDate() === yesterday.getDate()
        ) {
          newStreak = currentStats.daily_streak + 1;
          isConsecutive = true;
        } else if (lastDate.toISOString().split("T")[0] !== today) {
          // Si la última actividad no fue hoy ni ayer, reiniciar racha
          newStreak = 1;
        }
        // Si la última actividad fue hoy, mantener la racha
      } else {
        // Primera vez que registra algo
        newStreak = 1;
      }

      const newXP = currentStats.xp_points + 10;
      const newLevel = calculateLevel(newXP);

      // Actualizar stats
      const { data: updated, error } = await supabase
        .from("user_stats")
        .update({
          xp_points: newXP,
          level: newLevel,
          daily_streak: newStreak,
          last_activity_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid)
        .select("*")
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      if (!updated) {
        return { ok: false, message: "No se pudo actualizar las estadísticas." };
      }

      console.log(
        `[Gamification] +10 XP por registro diario. Racha: ${newStreak} días. Total: ${newXP} XP`,
      );

      // Verificar achievements de racha
      if (newStreak === 7) {
        await this.unlockAchievement("week_streak");
      } else if (newStreak === 30) {
        await this.unlockAchievement("month_streak");
      }

      return { ok: true, data: updated as UserStats };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al registrar registro diario",
      };
    }
  },

  /**
   * Desbloquea un achievement para el usuario
   */
  async unlockAchievement(achievementType: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return;
      const uid = uidRes.data;

      // Verificar si ya tiene el achievement
      const { data: existing } = await supabase
        .from("user_achievements")
        .select("id")
        .eq("user_id", uid)
        .eq("achievement_type", achievementType)
        .maybeSingle();

      if (existing) {
        // Ya tiene el achievement, no hacer nada
        return;
      }

      // Crear achievement
      await supabase.from("user_achievements").insert({
        user_id: uid,
        achievement_type: achievementType,
        metadata: metadata || {},
      });

      console.log(`[Gamification] 🏆 Achievement desbloqueado: ${achievementType}`);
    } catch (error) {
      console.error("[Gamification] Error al desbloquear achievement:", error);
      // No lanzar error, solo loguear
    }
  },

  /**
   * Obtiene los achievements del usuario
   */
  async getUserAchievements(): Promise<RepoResult<UserAchievement[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { data, error } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", uid)
        .order("unlocked_at", { ascending: false });

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      return { ok: true, data: (data as UserAchievement[]) ?? [] };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener achievements",
      };
    }
  },

  /**
   * Obtiene el leaderboard (top 10 usuarios por XP)
   */
  async getLeaderboard(limit: number = 10): Promise<RepoResult<LeaderboardEntry[]>> {
    try {
      const { data, error } = await supabase
        .from("user_stats")
        .select(
          `
          user_id,
          xp_points,
          level,
          daily_streak,
          profiles!inner(full_name, email, is_premium)
        `,
        )
        .order("xp_points", { ascending: false })
        .limit(limit);

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      const entries: LeaderboardEntry[] = (data || []).map((item: any, index: number) => ({
        user_id: item.user_id,
        full_name: item.profiles?.full_name || null,
        email: item.profiles?.email || "",
        xp_points: item.xp_points || 0,
        level: item.level || 0,
        daily_streak: item.daily_streak || 0,
        rank: index + 1,
        is_premium: item.profiles?.is_premium || false,
      }));

      return { ok: true, data: entries };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener leaderboard",
      };
    }
  },

  /**
   * Obtiene la posición del usuario actual en el ranking
   */
  async getUserRankingPosition(): Promise<RepoResult<{ position: number; entry: LeaderboardEntry | null }>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Obtener XP del usuario
      const statsResult = await this.getUserStats();
      if (!statsResult.ok) {
        return { ok: false, message: statsResult.message };
      }

      const userXP = statsResult.data.xp_points;

      // Contar cuántos usuarios tienen más XP
      const { count, error } = await supabase
        .from("user_stats")
        .select("*", { count: "exact", head: true })
        .gt("xp_points", userXP);

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      const position = (count || 0) + 1;

      // Obtener datos del usuario para el entry
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, is_premium")
        .eq("id", uid)
        .maybeSingle();

      const entry: LeaderboardEntry = {
        user_id: uid,
        full_name: profileData?.full_name || null,
        email: profileData?.email || "",
        xp_points: userXP,
        level: statsResult.data.level,
        daily_streak: statsResult.data.daily_streak,
        rank: position,
        is_premium: profileData?.is_premium || false,
      };

      return { ok: true, data: { position, entry } };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener posición en ranking",
      };
    }
  },

  /**
   * Calcula el progreso hacia el siguiente nivel
   */
  getLevelProgress(stats: UserStats): {
    currentLevel: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progress: number; // 0-100
    xpRemaining: number;
  } {
    const currentLevel = stats.level;
    const currentXP = stats.xp_points;
    const currentLevelXP = xpForCurrentLevel(currentLevel);
    const nextLevelXP = xpForNextLevel(currentLevel);
    const xpInCurrentLevel = currentXP - currentLevelXP;
    const xpNeededForNext = nextLevelXP - currentLevelXP;
    const progress = xpNeededForNext > 0 ? (xpInCurrentLevel / xpNeededForNext) * 100 : 100;
    const xpRemaining = Math.max(0, nextLevelXP - currentXP);

    return {
      currentLevel,
      currentLevelXP,
      nextLevelXP,
      progress: Math.min(100, Math.max(0, progress)),
      xpRemaining,
    };
  },
};
