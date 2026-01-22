// src/domain/services/healthSyncService.ts
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { todayStrLocal } from "@/presentation/utils/date";
import { AppState, AppStateStatus, Platform } from "react-native";

/**
 * Servicio global para sincronización automática de Apple Health
 * Puede ser llamado desde el punto de entrada de la app
 */
export class HealthSyncService {
  private static lastSyncTime: number = 0;
  private static isSyncing: boolean = false;
  private static appState: AppStateStatus = AppState.currentState;
  private static hasInitialSync: boolean = false;
  private static subscription: ReturnType<typeof AppState.addEventListener> | null = null;

  /**
   * Inicializa el listener de AppState para sincronización automática
   * Debe ser llamado desde el punto de entrada de la app
   */
  static initialize(isPremium: boolean, syncCallback: () => Promise<void>): void {
    if (!isPremium) {
      console.log("[HealthSync] Usuario no premium, sincronización deshabilitada");
      this.cleanup();
      return;
    }

    // Configurar listener de AppState
    if (!this.subscription) {
      this.appState = AppState.currentState;

      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        // Solo sincronizar cuando la app pasa de 'background' o 'inactive' a 'active'
        if (
          this.appState.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          const now = Date.now();
          const timeSinceLastSync = now - this.lastSyncTime;
          const ONE_MINUTE = 60 * 1000;

          // No sincronizar si fue hace menos de 1 minuto
          if (timeSinceLastSync < ONE_MINUTE) {
            console.log(
              `[HealthSync] Sincronización omitida: última sync hace ${Math.round(timeSinceLastSync / 1000)}s (menos de 1 minuto)`,
            );
            this.appState = nextAppState;
            return;
          }

          // Evitar múltiples sincronizaciones simultáneas
          if (this.isSyncing) {
            console.log("[HealthSync] Sincronización ya en curso, omitiendo...");
            this.appState = nextAppState;
            return;
          }

          console.log("[HealthSync] Sincronización automática disparada por cambio de estado");
          this.isSyncing = true;
          this.lastSyncTime = now;

          syncCallback()
            .catch((error) => {
              console.error("[HealthSync] Error en sincronización automática:", error);
            })
            .finally(() => {
              this.isSyncing = false;
            });
        }

        this.appState = nextAppState;
      };

      this.subscription = AppState.addEventListener("change", handleAppStateChange);
      console.log("[HealthSync] Listener de AppState inicializado");
    }

    // Sincronización al inicio (Cold Start) - solo una vez por sesión
    if (!this.hasInitialSync) {
      const timer = setTimeout(() => {
        const now = Date.now();
        const timeSinceLastSync = now - this.lastSyncTime;
        const ONE_MINUTE = 60 * 1000;

        // Solo sincronizar al inicio si no se ha sincronizado recientemente
        if (timeSinceLastSync >= ONE_MINUTE || this.lastSyncTime === 0) {
          if (!this.isSyncing) {
            console.log("[HealthSync] Sincronización al inicio (cold start)...");
            this.isSyncing = true;
            this.lastSyncTime = Date.now();
            this.hasInitialSync = true;

            syncCallback()
              .catch((error) => {
                console.error("[HealthSync] Error en sincronización al inicio:", error);
              })
              .finally(() => {
                this.isSyncing = false;
              });
          }
        }
      }, 1500); // Delay de 1.5s para asegurar que todo esté listo

      // No podemos hacer cleanup del timer aquí, pero está bien
    }
  }

  /**
   * Limpia el listener de AppState
   */
  static cleanup(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
      console.log("[HealthSync] Listener de AppState removido");
    }
  }

  /**
   * Resetea el estado de sincronización (útil para testing o cambios de usuario)
   */
  static reset(): void {
    this.lastSyncTime = 0;
    this.isSyncing = false;
    this.hasInitialSync = false;
    this.cleanup();
  }
}
