// src/core/analytics/track.ts
/**
 * Analytics tracking service.
 * Mantenerlo desacoplado para fácil integración con servicios externos (Mixpanel, Amplitude, etc.)
 */

type AnalyticsEvent = string;
type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

let isEnabled = __DEV__; // Solo en desarrollo por defecto

/**
 * Habilita o deshabilita el tracking de analytics
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  isEnabled = enabled;
}

/**
 * Trackea un evento de analytics
 * En producción, esto debería integrarse con un servicio de analytics real
 */
export function track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (!isEnabled) return;

  // En desarrollo, logueamos para debugging
  if (__DEV__) {
    console.log("[Analytics]", event, properties ?? {});
  }

  // TODO: Integrar con servicio de analytics en producción
  // Ejemplo: Mixpanel.track(event, properties);
  // Ejemplo: Amplitude.logEvent(event, properties);
}

/**
 * Identifica al usuario para analytics
 */
export function identify(userId: string, traits?: AnalyticsProperties): void {
  if (!isEnabled) return;

  if (__DEV__) {
    console.log("[Analytics] Identify", userId, traits ?? {});
  }

  // TODO: Integrar con servicio de analytics
  // Ejemplo: Mixpanel.identify(userId, traits);
}

/**
 * Establece propiedades del usuario
 */
export function setUserProperties(properties: AnalyticsProperties): void {
  if (!isEnabled) return;

  if (__DEV__) {
    console.log("[Analytics] Set User Properties", properties);
  }

  // TODO: Integrar con servicio de analytics
}
