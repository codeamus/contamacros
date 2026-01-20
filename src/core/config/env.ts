// src/core/config/env.ts
/**
 * Configuración de variables de entorno
 * En Expo usa EXPO_PUBLIC_* para variables públicas
 */

export const env = {
  // API
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
  
  // Environment
  isDev: __DEV__,
  isProduction: !__DEV__,
  
  // Feature flags (pueden venir de env o config)
  enableAnalytics: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === "true",
} as const;

/**
 * Valida que las variables de entorno requeridas estén presentes
 */
export function validateEnv(): void {
  const required: Array<keyof typeof env> = [];
  
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

