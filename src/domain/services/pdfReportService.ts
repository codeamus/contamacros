// src/domain/services/pdfReportService.ts
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { AuthService } from "@/domain/services/authService";

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

interface ReportData {
  startDate: string;
  endDate: string;
  profile: {
    fullName: string;
    avatarUrl: string | null;
  };
  summary: {
    totalCaloriesConsumed: number;
    totalCaloriesBurned: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    averageCaloriesPerDay: number;
    consistency: {
      daysWithLogs: number;
      totalDays: number;
      percentage: number;
    };
  };
  dailyMeals: Array<{
    day: string;
    meals: Array<{
      meal: string;
      name: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }>;
    totalCalories: number;
    caloriesBurned: number;
  }>;
}

/**
 * Genera un reporte PDF con los datos nutricionales del usuario
 */
export class PdfReportService {
  /**
   * Obtiene todos los datos necesarios para el reporte
   */
  static async getReportData(
    startDate: string,
    endDate: string,
  ): Promise<RepoResult<ReportData>> {
    try {
      // Obtener perfil
      const profileRes = await AuthService.getMyProfile();
      if (!profileRes.ok || !profileRes.data) {
        return { ok: false, message: "No se pudo obtener el perfil" };
      }
      const profile = profileRes.data;

      // Obtener estadísticas del rango
      const statsRes = await foodLogRepository.getBentoStats(startDate, endDate);
      if (!statsRes.ok) {
        return { ok: false, message: statsRes.message };
      }
      const stats = statsRes.data;

      // Obtener todas las comidas del rango
      const mealsRes = await this.getDailyMeals(startDate, endDate);
      if (!mealsRes.ok) {
        return { ok: false, message: mealsRes.message };
      }

      // Obtener calorías quemadas por día
      const activityRes = await this.getDailyActivity(startDate, endDate);
      if (!activityRes.ok) {
        return { ok: false, message: activityRes.message };
      }

      // Combinar datos de comidas con actividad
      const dailyMeals = mealsRes.data.map((day) => {
        const activity = activityRes.data.find((a) => a.day === day.day);
        return {
          ...day,
          caloriesBurned: activity?.caloriesBurned || 0,
        };
      });

      // Calcular promedio de calorías por día
      const daysWithData = dailyMeals.filter((d) => d.totalCalories > 0).length;
      const averageCaloriesPerDay =
        daysWithData > 0 ? stats.totalMacros.totalCalories / daysWithData : 0;

      return {
        ok: true,
        data: {
          startDate,
          endDate,
          profile: {
            fullName: profile.full_name || "Usuario",
            avatarUrl: profile.avatar_url,
          },
          summary: {
            totalCaloriesConsumed: stats.totalMacros.totalCalories,
            totalCaloriesBurned: activityRes.data.reduce(
              (sum, a) => sum + a.caloriesBurned,
              0,
            ),
            totalProtein: stats.totalMacros.protein_g,
            totalCarbs: stats.totalMacros.carbs_g,
            totalFat: stats.totalMacros.fat_g,
            averageCaloriesPerDay: Math.round(averageCaloriesPerDay),
            consistency: stats.consistency,
          },
          dailyMeals,
        },
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Error al generar reporte",
      };
    }
  }

  /**
   * Obtiene todas las comidas agrupadas por día
   */
  private static async getDailyMeals(
    startDate: string,
    endDate: string,
  ): Promise<
    RepoResult<
      Array<{
        day: string;
        meals: Array<{
          meal: string;
          name: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
        }>;
        totalCalories: number;
      }>
    >
  > {
    try {
      // Obtener todos los logs del rango
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days: string[] = [];
      
      // Generar array de días en el rango
      const current = new Date(start);
      while (current <= end) {
        days.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }

      // Obtener logs de cada día
      const allMeals: Array<{
        day: string;
        meals: Array<{
          meal: string;
          name: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
        }>;
        totalCalories: number;
      }> = [];

      for (const day of days) {
        const logsRes = await foodLogRepository.listByDay(day);
        if (logsRes.ok && logsRes.data) {
          const meals = logsRes.data.map((log) => ({
            meal: this.getMealLabel(log.meal),
            name: log.name,
            calories: log.calories,
            protein_g: log.protein_g,
            carbs_g: log.carbs_g,
            fat_g: log.fat_g,
          }));

          const totalCalories = meals.reduce(
            (sum, m) => sum + m.calories,
            0,
          );

          allMeals.push({
            day,
            meals,
            totalCalories,
          });
        } else {
          // Día sin registros
          allMeals.push({
            day,
            meals: [],
            totalCalories: 0,
          });
        }
      }

      return { ok: true, data: allMeals };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al obtener comidas diarias",
      };
    }
  }

  /**
   * Obtiene las calorías quemadas por día
   */
  private static async getDailyActivity(
    startDate: string,
    endDate: string,
  ): Promise<
    RepoResult<Array<{ day: string; caloriesBurned: number }>>
  > {
    try {
      // Obtener actividad reciente (últimos 30 días por defecto, pero puede ser más)
      const daysDiff = Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const recentDays = Math.max(daysDiff + 1, 30);
      
      const activityRes = await activityLogRepository.getRecentActivity(recentDays);
      if (!activityRes.ok) {
        return { ok: false, message: activityRes.message };
      }

      // Crear mapa de actividades por día
      const activityMap = new Map<string, number>();
      for (const activity of activityRes.data) {
        if (activity.day >= startDate && activity.day <= endDate) {
          activityMap.set(activity.day, activity.calories_burned || 0);
        }
      }

      // Generar array de días en el rango
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        days.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }

      // Mapear días con sus actividades
      const activities = days.map((day) => ({
        day,
        caloriesBurned: activityMap.get(day) || 0,
      }));

      return { ok: true, data: activities };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al obtener actividad diaria",
      };
    }
  }

  /**
   * Convierte el tipo de comida a etiqueta legible
   */
  private static getMealLabel(meal: string): string {
    const labels: Record<string, string> = {
      breakfast: "Desayuno",
      lunch: "Almuerzo",
      dinner: "Cena",
      snack: "Snack",
    };
    return labels[meal] || meal;
  }

  /**
   * Genera el HTML del reporte
   */
  static generateReportHTML(data: ReportData): string {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const formatDay = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
      });
    };

    // Para PDFs, las imágenes externas pueden no cargar, así que usamos un placeholder
    const avatarHtml = `<div style="width: 60px; height: 60px; border-radius: 30px; background: linear-gradient(135deg, #22C55E 0%, #10B981 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">${data.profile.fullName.charAt(0).toUpperCase()}</div>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1B3A2F;
      line-height: 1.6;
      padding: 40px;
      background: #F6F7EB;
    }
    .header {
      background: linear-gradient(135deg, #22C55E 0%, #10B981 100%);
      color: white;
      padding: 30px;
      border-radius: 20px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 4px 20px rgba(34, 197, 94, 0.3);
    }
    .header-content h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header-content p {
      opacity: 0.9;
      font-size: 14px;
    }
    .summary {
      background: white;
      padding: 25px;
      border-radius: 16px;
      margin-bottom: 30px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 20px;
    }
    .summary-item {
      padding: 15px;
      background: #F6F7EB;
      border-radius: 12px;
      border-left: 4px solid #22C55E;
    }
    .summary-item h3 {
      font-size: 12px;
      color: #2C4B40;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-item .value {
      font-size: 24px;
      font-weight: 700;
      color: #1B3A2F;
    }
    .summary-item .unit {
      font-size: 14px;
      color: #2C4B40;
      margin-left: 4px;
    }
    .daily-section {
      background: white;
      padding: 25px;
      border-radius: 16px;
      margin-bottom: 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .daily-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #E1E5D3;
    }
    .daily-header h2 {
      font-size: 18px;
      color: #1B3A2F;
    }
    .daily-stats {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: #2C4B40;
    }
    .meals-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .meals-table th {
      background: #F6F7EB;
      padding: 12px;
      text-align: left;
      font-size: 12px;
      color: #2C4B40;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #E1E5D3;
    }
    .meals-table td {
      padding: 12px;
      border-bottom: 1px solid #E1E5D3;
      font-size: 14px;
    }
    .meals-table tr:last-child td {
      border-bottom: none;
    }
    .meal-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      background: #22C55E;
      color: white;
    }
    .consistency-bar {
      width: 100%;
      height: 24px;
      background: #E1E5D3;
      border-radius: 12px;
      overflow: hidden;
      margin-top: 10px;
    }
    .consistency-fill {
      height: 100%;
      background: linear-gradient(90deg, #22C55E 0%, #10B981 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 600;
      transition: width 0.3s;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #E1E5D3;
      color: #2C4B40;
      font-size: 12px;
    }
    .empty-day {
      text-align: center;
      padding: 30px;
      color: #2C4B40;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    ${avatarHtml}
    <div class="header-content">
      <h1>Reporte Nutricional</h1>
      <p>${data.profile.fullName}</p>
      <p style="font-size: 12px; margin-top: 4px;">${formatDate(data.startDate)} - ${formatDate(data.endDate)}</p>
    </div>
  </div>

  <div class="summary">
    <h2 style="font-size: 20px; margin-bottom: 15px; color: #1B3A2F;">Resumen del Período</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <h3>Calorías Consumidas</h3>
        <div class="value">${data.summary.totalCaloriesConsumed.toLocaleString()}<span class="unit">kcal</span></div>
      </div>
      <div class="summary-item">
        <h3>Calorías Quemadas</h3>
        <div class="value">${data.summary.totalCaloriesBurned.toLocaleString()}<span class="unit">kcal</span></div>
      </div>
      <div class="summary-item">
        <h3>Promedio Diario</h3>
        <div class="value">${data.summary.averageCaloriesPerDay.toLocaleString()}<span class="unit">kcal</span></div>
      </div>
      <div class="summary-item">
        <h3>Consistencia</h3>
        <div class="value">${data.summary.consistency.percentage}<span class="unit">%</span></div>
        <div class="consistency-bar">
          <div class="consistency-fill" style="width: ${data.summary.consistency.percentage}%">
            ${data.summary.consistency.daysWithLogs} de ${data.summary.consistency.totalDays} días
          </div>
        </div>
      </div>
      <div class="summary-item">
        <h3>Proteína Total</h3>
        <div class="value">${data.summary.totalProtein.toFixed(1)}<span class="unit">g</span></div>
      </div>
      <div class="summary-item">
        <h3>Carbohidratos Total</h3>
        <div class="value">${data.summary.totalCarbs.toFixed(1)}<span class="unit">g</span></div>
      </div>
      <div class="summary-item">
        <h3>Grasas Total</h3>
        <div class="value">${data.summary.totalFat.toFixed(1)}<span class="unit">g</span></div>
      </div>
      <div class="summary-item">
        <h3>Balance Calórico</h3>
        <div class="value" style="color: ${data.summary.totalCaloriesConsumed - data.summary.totalCaloriesBurned >= 0 ? '#EF4444' : '#10B981'}">
          ${(data.summary.totalCaloriesConsumed - data.summary.totalCaloriesBurned).toLocaleString()}<span class="unit">kcal</span>
        </div>
      </div>
    </div>
  </div>

  ${data.dailyMeals
    .map(
      (day) => `
  <div class="daily-section">
    <div class="daily-header">
      <h2>${formatDay(day.day)}</h2>
      <div class="daily-stats">
        <span>🍽️ ${day.totalCalories} kcal consumidas</span>
        ${day.caloriesBurned > 0 ? `<span>🔥 ${day.caloriesBurned} kcal quemadas</span>` : ''}
      </div>
    </div>
    ${
      day.meals.length > 0
        ? `
    <table class="meals-table">
      <thead>
        <tr>
          <th>Comida</th>
          <th>Alimento</th>
          <th>Calorías</th>
          <th>Proteína</th>
          <th>Carbs</th>
          <th>Grasas</th>
        </tr>
      </thead>
      <tbody>
        ${day.meals
          .map(
            (meal) => `
        <tr>
          <td><span class="meal-badge">${meal.meal}</span></td>
          <td>${meal.name}</td>
          <td>${meal.calories}</td>
          <td>${meal.protein_g.toFixed(1)}g</td>
          <td>${meal.carbs_g.toFixed(1)}g</td>
          <td>${meal.fat_g.toFixed(1)}g</td>
        </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
    `
        : `<div class="empty-day">Sin registros este día</div>`
    }
  </div>
  `,
    )
    .join("")}

  <div class="footer">
    <p>Generado por ContaMacros • ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Genera el HTML del reporte y lo devuelve para mostrar o compartir
   */
  static async generateReportHTMLString(
    startDate: string,
    endDate: string,
  ): Promise<RepoResult<string>> {
    try {
      // Obtener datos del reporte
      const dataRes = await this.getReportData(startDate, endDate);
      if (!dataRes.ok) {
        return { ok: false, message: dataRes.message };
      }

      // Generar HTML
      const html = this.generateReportHTML(dataRes.data);

      return { ok: true, data: html };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al generar el reporte",
      };
    }
  }

  /**
   * Genera y comparte el reporte como HTML
   * Devuelve el HTML para que el componente lo maneje (mostrar en modal, compartir, etc.)
   */
  static async generateAndSharePDF(
    startDate: string,
    endDate: string,
  ): Promise<RepoResult<string>> {
    try {
      // Obtener HTML del reporte
      const htmlRes = await this.generateReportHTMLString(startDate, endDate);
      if (!htmlRes.ok) {
        return { ok: false, message: htmlRes.message };
      }

      // Devolver el HTML directamente
      // El componente puede mostrarlo en un WebView o usar otra estrategia de compartir
      return { ok: true, data: htmlRes.data };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al generar el reporte",
      };
    }
  }
}
