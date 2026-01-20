# Esquema de Base de Datos - ContaMacros (Supabase)

Este es el esquema de referencia para la base de datos. Úsalo para validar tipos de datos, relaciones y constraints en las llamadas de Supabase.

## Tabla: profiles
- Relacionada 1:1 con `auth.users`.
- Campos clave: `goal` (deficit, maintain, surplus), `daily_calorie_target`, `onboarding_completed`.

## Tabla: food_logs
- Diario de consumo del usuario.
- Relaciones: `user_id`, `food_id` (opcional), `user_food_id` (opcional).
- `source_type`: Puede ser 'food', 'user_food' o 'manual'.

## Tabla: foods & generic_foods
- `foods`: Base de datos global con campo `verified`.
- `generic_foods`: Alimentos base (ej: Manzana) con campos en `_100g`.

## Tabla: user_foods
- Alimentos creados por el propio usuario.

---
## SQL de Referencia (Contexto)
{Pega aquí el código SQL que me acabas de pasar}