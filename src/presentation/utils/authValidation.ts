export function isValidEmail(email: string) {
  // Suficiente para UX (no perfecto, pero práctico)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isStrongEnoughPassword(pw: string) {
  // MVP: mínimo 6
  return pw.trim().length >= 6;
}
