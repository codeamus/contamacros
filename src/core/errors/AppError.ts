// src/core/errors/AppError.ts
/**
 * Clase base para errores de la aplicación
 * Permite categorizar y manejar errores de forma consistente
 */

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  
  // Auth errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  
  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  
  // Data errors
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  
  // Server errors
  SERVER_ERROR = "SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  
  // Unknown
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    public readonly originalError?: unknown,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    
    // Mantiene el stack trace correcto
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Crea un AppError desde un error desconocido
   */
  static fromUnknown(error: unknown, defaultMessage = "Ha ocurrido un error"): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(
        error.message || defaultMessage,
        ErrorCode.UNKNOWN_ERROR,
        error,
      );
    }

    return new AppError(
      defaultMessage,
      ErrorCode.UNKNOWN_ERROR,
      error,
    );
  }

  /**
   * Crea un AppError de red
   */
  static network(message = "Error de conexión. Verifica tu internet."): AppError {
    return new AppError(message, ErrorCode.NETWORK_ERROR);
  }

  /**
   * Crea un AppError de validación
   */
  static validation(message: string, metadata?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, undefined, metadata);
  }

  /**
   * Crea un AppError de no encontrado
   */
  static notFound(resource: string): AppError {
    return new AppError(
      `${resource} no encontrado`,
      ErrorCode.NOT_FOUND,
      undefined,
      { resource },
    );
  }
}
