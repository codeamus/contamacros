function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayStrLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/**
 * Formatea una fecha YYYY-MM-DD a formato español elegante
 * Ejemplos:
 * - "2025-01-15" -> "Lunes, 15 de enero"
 * - Si es hoy: "Hoy, 15 de enero"
 */
export function formatDateToSpanish(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return ymd;

  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const weekdays = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const weekday = weekdays[date.getDay()];
  const month = months[m - 1];

  if (isToday) {
    return `Hoy, ${d} de ${month}`;
  }

  return `${weekday}, ${d} de ${month}`;
}
