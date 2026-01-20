// src/core/constants/app.ts
/**
 * Constantes de la aplicación
 */

export const APP_NAME = "ContaMacros";
export const APP_VERSION = "1.0.0";

// Límites de validación
export const VALIDATION_LIMITS = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128,
  MIN_EMAIL_LENGTH: 3,
  MAX_EMAIL_LENGTH: 254,
  MIN_HEIGHT_CM: 100,
  MAX_HEIGHT_CM: 250,
  MIN_WEIGHT_KG: 30,
  MAX_WEIGHT_KG: 250,
  MIN_AGE_YEARS: 13,
  MAX_AGE_YEARS: 90,
  MIN_GRAMS: 1,
  MAX_GRAMS: 2000,
  MIN_CALORIES: 0,
  MAX_CALORIES: 10000,
} as const;

// Debounce delays (en ms)
export const DEBOUNCE_DELAYS = {
  SEARCH: 320,
  INPUT: 300,
} as const;

// Timeouts (en ms)
export const TIMEOUTS = {
  NETWORK_REQUEST: 30000,
  TOAST_DURATION: 2500,
  TOAST_SUCCESS: 2000,
  TOAST_ERROR: 3000,
} as const;

// Paginación
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  SEARCH_RESULTS_LIMIT: 50,
} as const;
