// src/core/types/Result.ts
/**
 * Tipo Result para operaciones que pueden fallar
 * Pattern funcional para manejo de errores sin excepciones
 */

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; message?: string };

/**
 * Helper para crear un Result exitoso
 */
export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

/**
 * Helper para crear un Result fallido
 */
export function err<E = string>(error: E, message?: string): Result<never, E> {
  return { ok: false, error, message };
}

/**
 * Tipo legacy para compatibilidad con código existente
 * @deprecated Usar Result<T> en su lugar
 */
export type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };
