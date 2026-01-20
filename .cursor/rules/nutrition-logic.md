# Reglas de Lógica Nutricional - ContaMacros

- **Fórmula Base:** Usar siempre Mifflin-St Jeor (implementada en `calorieGoals.ts`).
- **Redondeo:** Las calorías siempre se redondean a la decena más cercana (step: 10).
- **Macros:** - Proteína: 2.0g por kg de peso.
  - Grasas: 0.8g por kg de peso.
  - Carbohidratos: El resto de calorías disponibles.
- **Seguridad:** Nunca permitir que los carbohidratos bajen de 30g/día. Si ocurre, reducir grasa y proteína proporcionalmente.