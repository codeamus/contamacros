export const goalLabel = (goal: string) => {
  switch (goal) {
    case "deficit":
      return "Bajar de peso";
    case "maintain":
    case "maintenance":
      return "Mantener peso";
    case "surplus":
      return "Subir masa muscular";
    default:
      return "—";
  }
};

export const activityLabel = (level: string) => {
  switch (level) {
    case "sedentary":
      return "Sedentario";
    case "light":
      return "Ligero (1–3 días/semana)";
    case "moderate":
      return "Moderado (3–5 días/semana)";
    case "high":
      return "Alto (6–7 días/semana)";
    case "very_high":
      return "Muy alto (entrenamiento intenso)";
    default:
      return "—";
  }
};
