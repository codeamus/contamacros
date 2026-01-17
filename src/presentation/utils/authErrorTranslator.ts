// src/presentation/utils/authErrorTranslator.ts
export function translateAuthError(message?: string): string {
  if (!message) return "No pudimos crear tu cuenta. Intenta nuevamente.";

  const msg = message.toLowerCase();

  if (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  ) {
    return "Este email ya está registrado. Inicia sesión o usa otro email.";
  }

  if (msg.includes("password")) {
    return "La contraseña no cumple los requisitos mínimos.";
  }

  if (msg.includes("email")) {
    return "El email ingresado no es válido.";
  }

  if (msg.includes("network")) {
    return "Problema de conexión. Revisa tu internet.";
  }

  return "No pudimos crear tu cuenta. Intenta nuevamente.";
}
