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
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.food_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day text NOT NULL,
  meal text NOT NULL DEFAULT 'snack'::text,
  name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein_g integer NOT NULL DEFAULT 0,
  carbs_g integer NOT NULL DEFAULT 0,
  fat_g integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  grams numeric,
  source text,
  off_id text,
  source_type text,
  food_id uuid,
  user_food_id uuid,
  CONSTRAINT food_logs_pkey PRIMARY KEY (id),
  CONSTRAINT food_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT food_logs_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id),
  CONSTRAINT food_logs_user_food_id_fkey FOREIGN KEY (user_food_id) REFERENCES public.user_foods(id)
);
CREATE TABLE public.foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  portion_unit text NOT NULL,
  portion_base numeric NOT NULL,
  calories numeric NOT NULL,
  protein numeric NOT NULL,
  carbs numeric NOT NULL,
  fat numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual_seed'::text,
  verified boolean NOT NULL DEFAULT false,
  country_scope text NOT NULL DEFAULT 'CL/LATAM'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  barcode text,
  brand text,
  CONSTRAINT foods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.generic_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name_es text NOT NULL,
  name_norm text NOT NULL UNIQUE,
  aliases ARRAY NOT NULL DEFAULT '{}'::text[],
  aliases_norm ARRAY NOT NULL DEFAULT '{}'::text[],
  aliases_search text NOT NULL DEFAULT ''::text,
  kcal_100g integer,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric,
  unit_label_es text,
  grams_per_unit numeric,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  country_tags ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT generic_foods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  full_name text,
  height_cm integer,
  weight_kg numeric,
  goal text CHECK (goal = ANY (ARRAY['deficit'::text, 'maintain'::text, 'surplus'::text])),
  onboarding_completed boolean DEFAULT false,
  daily_calorie_target integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  gender text,
  birth_date date,
  activity_level text,
  goal_adjustment numeric,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  base_food_id uuid,
  name text NOT NULL,
  category text NOT NULL,
  portion_unit text NOT NULL,
  portion_base numeric NOT NULL,
  calories numeric NOT NULL,
  protein numeric NOT NULL,
  carbs numeric NOT NULL,
  fat numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_foods_pkey PRIMARY KEY (id),
  CONSTRAINT user_foods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_foods_base_food_id_fkey FOREIGN KEY (base_food_id) REFERENCES public.foods(id)
);