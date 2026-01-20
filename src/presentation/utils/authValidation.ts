// src/presentation/utils/authValidation.ts
/**
 * Utilidades de validación para autenticación
 */

import { VALIDATION_LIMITS } from "@/core/constants/app";

/**
 * Valida formato de email
 * Regex simple pero efectivo para UX
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  
  const trimmed = email.trim();
  if (trimmed.length < VALIDATION_LIMITS.MIN_EMAIL_LENGTH) return false;
  if (trimmed.length > VALIDATION_LIMITS.MAX_EMAIL_LENGTH) return false;
  
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Valida fortaleza de contraseña
 */
export function isStrongEnoughPassword(password: string): boolean {
  if (!password || typeof password !== "string") return false;
  
  const trimmed = password.trim();
  return (
    trimmed.length >= VALIDATION_LIMITS.MIN_PASSWORD_LENGTH &&
    trimmed.length <= VALIDATION_LIMITS.MAX_PASSWORD_LENGTH
  );
}

/**
 * Obtiene mensaje de error para email inválido
 */
export function getEmailError(email: string): string | null {
  if (!email.trim()) return "El email es requerido";
  if (!isValidEmail(email)) return "Email inválido";
  return null;
}

/**
 * Obtiene mensaje de error para contraseña inválida
 */
export function getPasswordError(password: string): string | null {
  if (!password.trim()) return "La contraseña es requerida";
  if (!isStrongEnoughPassword(password)) {
    return `La contraseña debe tener al menos ${VALIDATION_LIMITS.MIN_PASSWORD_LENGTH} caracteres`;
  }
  return null;
}
