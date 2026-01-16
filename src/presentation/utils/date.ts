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
