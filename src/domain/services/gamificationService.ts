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
  contribution_count: number; // Número de alimentos creados
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
  full_name: string; // Obligatorio para evitar valores por defecto
  email: string;
  avatar_url: string | null;
  xp_points: number;
  level: number;
  daily_streak: number;
  contribution_count: number; // Número de alimentos creados
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
        // Calcular level dinámicamente si no viene de la BD
        const statsWithLevel = {
          ...existing,
          level: calculateLevel(existing.xp_points || 0),
        } as UserStats;
        return { ok: true, data: statsWithLevel };
      }

      // Crear stats iniciales si no existen
      // NO incluimos level porque es dinámico basado en XP
      const { data: newStats, error: createError } = await supabase
        .from("user_stats")
        .insert({
          user_id: uid,
          xp_points: 0,
          daily_streak: 0,
          last_activity_date: null,
          total_foods_contributed: 0,
          contribution_count: 0,
        })
        .select("*")
        .maybeSingle();

      if (createError) {
        return { ok: false, message: createError.message, code: createError.code };
      }

      if (!newStats) {
        return { ok: false, message: "No se pudieron crear las estadísticas." };
      }

      // Calcular level dinámicamente si no viene de la BD
      const statsWithLevel = {
        ...newStats,
        level: calculateLevel(newStats.xp_points || 0),
      } as UserStats;
      return { ok: true, data: statsWithLevel };
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
      // NO incluimos level porque es dinámico basado en XP
      const { data: updated, error } = await supabase
        .from("user_stats")
        .update({
          xp_points: newXP,
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

      // Actualizar stats (incrementar contribution_count y total_foods_contributed)
      // NO incluimos level porque es dinámico basado en XP
      const { data: updated, error } = await supabase
        .from("user_stats")
        .update({
          xp_points: newXP,
          total_foods_contributed: currentStats.total_foods_contributed + 1,
          contribution_count: (currentStats.contribution_count || 0) + 1,
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
      // NO incluimos level porque es dinámico basado en XP
      const { data: updated, error } = await supabase
        .from("user_stats")
        .update({
          xp_points: newXP,
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
   * Obtiene el leaderboard (top 10 usuarios por número de aportes)
   * Ordenado por contribution_count DESC
   * Usa la relación profiles:id para el JOIN
   */
  async getLeaderboard(limit: number = 10): Promise<RepoResult<LeaderboardEntry[]>> {
    try {
      // La relación es a través de la columna id (user_stats.id -> profiles.id)
      const { data, error } = await supabase
        .from("user_stats")
        .select(
          `
          id,
          xp_points,
          contribution_count,
          profiles (
            full_name,
            avatar_url,
            is_premium
          )
        `,
        )
        .order("contribution_count", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[GamificationService] ❌ Error en getLeaderboard:", error);
        return { ok: false, message: error.message, code: error.code };
      }

      console.log("[GamificationService] 📦 Datos brutos de Supabase:", {
        totalItems: data?.length || 0,
        firstItemRaw: data?.[0] ? JSON.stringify(data[0], null, 2) : null,
        firstItemStructure: data?.[0] ? {
          has_id: !!data[0].id,
          has_xp_points: !!data[0].xp_points,
          has_contribution_count: !!data[0].contribution_count,
          has_profiles: !!data[0].profiles,
          profiles_type: typeof data[0].profiles,
          profiles_is_array: Array.isArray(data[0].profiles),
          profiles_value: data[0].profiles,
        } : null,
      });

      const entries: LeaderboardEntry[] = (data || []).map((item: any, index: number) => {
        // Extracción robusta del perfil que maneja tanto objetos como arrays de Supabase
        const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        
        console.log(`[GamificationService] 🔍 Mapeo item ${index + 1}:`, {
          item_id: item.id,
          raw_profiles: item.profiles,
          profiles_type: typeof item.profiles,
          profiles_is_array: Array.isArray(item.profiles),
          profileData_extracted: profileData,
          profileData_type: typeof profileData,
          profileData_full_name: profileData?.full_name,
          profileData_is_premium: profileData?.is_premium,
          final_full_name: profileData?.full_name || "Usuario Anónimo",
        });
        
        // Mapeo limpio de la entrada
        const mappedEntry = {
          user_id: item.id,
          full_name: profileData?.full_name || "Usuario Anónimo",
          avatar_url: profileData?.avatar_url || null,
          is_premium: profileData?.is_premium ?? false,
          xp_points: item.xp_points || 0,
          contribution_count: item.contribution_count || 0,
          level: calculateLevel(item.xp_points || 0),
          rank: index + 1,
          daily_streak: 0,
          email: "", // No incluimos email en el SELECT
        };
        
        console.log(`[GamificationService] ✅ Entry mapeada ${index + 1}:`, mappedEntry);
        
        return mappedEntry;
      });

      console.log("[GamificationService] 📊 Todas las entries finales:", entries.map(e => ({
        user_id: e.user_id,
        full_name: e.full_name,
        contribution_count: e.contribution_count,
      })));
      return { ok: true, data: entries };
    } catch (error) {
      console.error("[GamificationService] 💥 Excepción en getLeaderboard:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener leaderboard",
      };
    }
  },

  /**
   * Obtiene la posición del usuario actual en el ranking (basado en contribution_count)
   * Usa id en lugar de user_id para las consultas
   */
  async getUserRankingPosition(): Promise<RepoResult<{ position: number; entry: LeaderboardEntry }>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Obtener stats del usuario usando id (que es la columna de identificación)
      // NO pedimos level porque es dinámico basado en XP
      const { data: userStats, error: statsError } = await supabase
        .from("user_stats")
        .select("id, xp_points, contribution_count")
        .eq("id", uid)
        .maybeSingle();

      if (statsError) {
        console.error("[GamificationService] ❌ Error obteniendo stats:", statsError);
        return { ok: false, message: statsError.message, code: statsError.code };
      }

      if (!userStats) {
        console.error("[GamificationService] ❌ No se encontraron stats para el usuario");
        return { ok: false, message: "No se encontraron estadísticas del usuario" };
      }

      // Obtener datos del usuario para el entry
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url, is_premium")
        .eq("id", uid)
        .maybeSingle();

      console.log("[GamificationService] 👤 Datos del perfil del usuario actual:", {
        uid: uid,
        profileData: profileData,
        profileError: profileError ? { message: profileError.message, code: profileError.code } : null,
        full_name: profileData?.full_name,
        email: profileData?.email,
        is_premium: profileData?.is_premium,
      });

      if (profileError) {
        console.error("[GamificationService] ❌ Error obteniendo perfil:", profileError);
      }

      // Obtener posición por contribution_count
      const { count: contributionCount, error: countError } = await supabase
        .from("user_stats")
        .select("*", { count: "exact", head: true })
        .gt("contribution_count", userStats.contribution_count || 0);

      if (countError) {
        console.error("[GamificationService] ❌ Error contando usuarios:", countError);
      }

      const contributionPosition = (contributionCount || 0) + 1;
      const userXP = userStats.xp_points || 0;

      // Mapeo consistente usando profileData?.full_name
      const entry: LeaderboardEntry = {
        user_id: userStats.id,
        full_name: profileData?.full_name || "Usuario Anónimo",
        avatar_url: profileData?.avatar_url || null,
        email: profileData?.email || "",
        xp_points: userXP,
        level: calculateLevel(userXP),
        daily_streak: 0,
        contribution_count: userStats.contribution_count || 0,
        rank: contributionPosition,
        is_premium: profileData?.is_premium ?? false,
      };

      return { ok: true, data: { position: contributionPosition, entry } };
    } catch (error) {
      console.error("[GamificationService] 💥 Excepción en getUserRankingPosition:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener posición",
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
    // Calcular nivel dinámicamente basado en XP (no leer de stats.level)
    const currentLevel = calculateLevel(stats.xp_points);
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
