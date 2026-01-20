// src/core/errors/errorHandler.ts
/**
 * Manejo centralizado de errores
 */

import { AppError, ErrorCode } from "./AppError";
import { track } from "../analytics/track";

/**
 * Convierte un error desconocido a un mensaje amigable para el usuario
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Errores comunes de red
    if (error.message.includes("Network request failed") || 
        error.message.includes("fetch")) {
      return "Error de conexión. Verifica tu internet.";
    }

    // Errores de timeout
    if (error.message.includes("timeout")) {
      return "La solicitud tardó demasiado. Intenta de nuevo.";
    }

    return error.message || "Ha ocurrido un error inesperado.";
  }

  return "Ha ocurrido un error inesperado.";
}

/**
 * Maneja un error y lo reporta a analytics
 */
export function handleError(error: unknown, context?: string): AppError {
  const appError = AppError.fromUnknown(error);
  
  // Track error en analytics (solo en producción si está habilitado)
  track("error_occurred", {
    code: appError.code,
    message: appError.message,
    context: context || "unknown",
    hasOriginalError: !!appError.originalError,
  });

  // En desarrollo, logueamos el error completo
  if (__DEV__) {
    console.error(`[ErrorHandler] ${context || "Unknown context"}:`, {
      error: appError,
      original: appError.originalError,
      metadata: appError.metadata,
    });
  }

  return appError;
}

/**
 * Wrapper para funciones async que maneja errores automáticamente
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw handleError(error, context);
  }
}
