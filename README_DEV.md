# 🛠️ README de Desarrollo - ContaMacros

Este documento contiene comandos SQL, scripts de migración y utilidades de desarrollo para el proyecto ContaMacros.

**Última actualización:** Enero 2025

---

## 📋 Comandos SQL Útiles

### Ranking de Creadores

Obtener el top de usuarios por número de alimentos creados:

```sql
SELECT 
  us.user_id,
  p.full_name,
  p.email,
  us.contribution_count,
  us.xp_points,
  us.daily_streak,
  FLOOR(SQRT(us.xp_points / 100)) as level
FROM user_stats us
INNER JOIN profiles p ON us.id = p.id
ORDER BY us.contribution_count DESC
LIMIT 50;
```

### Ranking por XP

Obtener usuarios con más puntos de experiencia:

```sql
SELECT 
  p.full_name,
  p.email,
  us.xp_points,
  FLOOR(SQRT(us.xp_points / 100)) as level,
  us.contribution_count,
  us.daily_streak
FROM user_stats us
INNER JOIN profiles p ON us.id = p.id
ORDER BY us.xp_points DESC
LIMIT 20;
```

### Alimentos Más Registrados

Ver qué alimentos se registran más frecuentemente:

```sql
SELECT 
  name,
  COUNT(*) as times_logged,
  SUM(calories) as total_calories
FROM food_logs
WHERE food_id IS NOT NULL
GROUP BY name
ORDER BY times_logged DESC
LIMIT 20;
```

### Usuarios Premium

Listar todos los usuarios premium:

```sql
SELECT 
  id,
  full_name,
  email,
  is_premium,
  created_at
FROM profiles
WHERE is_premium = true
ORDER BY created_at DESC;
```

### Logs de un Usuario Específico

Ver todos los logs de un usuario:

```sql
SELECT 
  fl.day,
  fl.meal,
  fl.name,
  fl.calories,
  fl.protein_g,
  fl.carbs_g,
  fl.fat_g,
  fl.created_at
FROM food_logs fl
WHERE fl.user_id = 'USER_UUID_AQUI'
ORDER BY fl.day DESC, fl.created_at DESC;
```

### Resumen Diario de un Usuario

Calcular resumen nutricional por día:

```sql
SELECT 
  day,
  COUNT(*) as meals_count,
  SUM(calories) as total_calories,
  SUM(protein_g) as total_protein,
  SUM(carbs_g) as total_carbs,
  SUM(fat_g) as total_fat
FROM food_logs
WHERE user_id = 'USER_UUID_AQUI'
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

### Alimentos Creados por Usuario

Ver contribuciones de alimentos comunitarios:

```sql
SELECT 
  gf.name_es,
  gf.kcal_100g,
  gf.protein_100g,
  gf.carbs_100g,
  gf.fat_100g,
  gf.created_at
FROM generic_foods gf
WHERE gf.created_at >= '2025-01-01'
ORDER BY gf.created_at DESC;
```

### Achievements Desbloqueados

Ver logros de un usuario:

```sql
SELECT 
  ua.achievement_type,
  ua.unlocked_at,
  ua.metadata
FROM user_achievements ua
WHERE ua.user_id = 'USER_UUID_AQUI'
ORDER BY ua.unlocked_at DESC;
```

### Usuarios con Racha Más Larga

Ver usuarios con mejor racha diaria:

```sql
SELECT 
  p.full_name,
  us.daily_streak,
  us.last_activity_date,
  us.xp_points
FROM user_stats us
INNER JOIN profiles p ON us.id = p.id
ORDER BY us.daily_streak DESC
LIMIT 20;
```

---

## 🔧 Scripts de Migración y Mantenimiento

### Limpiar Alimentos Duplicados (Fuzzy)

Nota: Este script debe ejecutarse con cuidado, ya que puede eliminar datos.

```sql
-- Encontrar posibles duplicados en generic_foods
-- (Requiere función de similitud, mejor hacerlo desde la app)
SELECT 
  a.id,
  a.name_es,
  b.id as duplicate_id,
  b.name_es as duplicate_name
FROM generic_foods a
INNER JOIN generic_foods b ON a.id < b.id
WHERE LOWER(a.name_es) = LOWER(b.name_es)
   OR a.name_norm = b.name_norm;
```

### Actualizar Niveles (Si fuera necesario)

Nota: Los niveles se calculan dinámicamente, pero si necesitas actualizar algo:

```sql
-- Verificar usuarios sin user_stats
SELECT 
  p.id,
  p.full_name,
  p.email
FROM profiles p
LEFT JOIN user_stats us ON p.id = us.id
WHERE us.id IS NULL;
```

### Crear user_stats para Usuarios Existentes

Si un usuario no tiene `user_stats`, crear uno:

```sql
INSERT INTO user_stats (id, user_id, xp_points, daily_streak, total_foods_contributed, contribution_count)
SELECT 
  p.id,
  p.id,
  0,
  0,
  0,
  0
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_stats us WHERE us.id = p.id
);
```

### Actualizar contribution_count

Actualizar el contador de contribuciones basado en alimentos creados:

```sql
-- Esto se hace automáticamente en la app, pero si necesitas recalcular:
UPDATE user_stats us
SET contribution_count = (
  SELECT COUNT(*)
  FROM generic_foods gf
  WHERE gf.created_at >= us.created_at
  -- Nota: Esto es aproximado, mejor usar un campo de user_id en generic_foods si existe
);
```

---

## 🤖 Comandos para Bots y Automatización

### Seed de Alimentos

El script `scripts/seedFoods.ts` se ejecuta con:

```bash
npx tsx scripts/seedFoods.ts
```

Este script:
- Inserta/actualiza alimentos en `generic_foods`
- Normaliza nombres y aliases
- Calcula valores nutricionales

### Migración de Datos Legacy

Si necesitas migrar datos de `foods` a `generic_foods`:

```sql
-- Copiar alimentos de foods a generic_foods
INSERT INTO generic_foods (
  name_es,
  name_norm,
  aliases_search,
  kcal_100g,
  protein_100g,
  carbs_100g,
  fat_100g,
  tags,
  country_tags
)
SELECT 
  name,
  LOWER(REGEXP_REPLACE(name, '[^a-z0-9\s]', '', 'g')),
  LOWER(REGEXP_REPLACE(name, '[^a-z0-9\s]', '', 'g')),
  calories,
  protein,
  carbs,
  fat,
  ARRAY[]::text[],
  ARRAY['latam']::text[]
FROM foods
WHERE source = 'manual_seed'
ON CONFLICT (name_norm) DO NOTHING;
```

### Limpiar Logs Antiguos

Eliminar logs de más de 1 año (cuidado con esto):

```sql
DELETE FROM food_logs
WHERE day < CURRENT_DATE - INTERVAL '1 year';
```

### Resetear Estadísticas de Usuario

⚠️ **CUIDADO:** Esto elimina todas las estadísticas del usuario.

```sql
-- Resetear XP y racha de un usuario específico
UPDATE user_stats
SET 
  xp_points = 0,
  daily_streak = 0,
  contribution_count = 0,
  last_activity_date = NULL
WHERE user_id = 'USER_UUID_AQUI';
```

---

## 📊 Consultas de Análisis

### Actividad Diaria

Ver actividad de usuarios por día:

```sql
SELECT 
  fl.day,
  COUNT(DISTINCT fl.user_id) as active_users,
  COUNT(*) as total_logs,
  SUM(fl.calories) as total_calories_logged
FROM food_logs fl
WHERE fl.day >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY fl.day
ORDER BY fl.day DESC;
```

### Alimentos Más Populares por Categoría

```sql
SELECT 
  uf.category,
  COUNT(*) as times_used,
  COUNT(DISTINCT uf.user_id) as unique_users
FROM user_foods uf
GROUP BY uf.category
ORDER BY times_used DESC;
```

### Distribución de Objetivos

Ver distribución de objetivos de usuarios:

```sql
SELECT 
  goal,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM profiles), 2) as percentage
FROM profiles
WHERE goal IS NOT NULL
GROUP BY goal
ORDER BY user_count DESC;
```

### Usuarios Activos (Últimos 7 días)

```sql
SELECT 
  COUNT(DISTINCT user_id) as active_users
FROM food_logs
WHERE day >= CURRENT_DATE - INTERVAL '7 days';
```

---

## 🔐 Comandos de Seguridad (RLS)

### Verificar Políticas RLS

```sql
-- Ver todas las políticas de una tabla
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_stats';
```

### Deshabilitar RLS Temporalmente (Solo para Debug)

⚠️ **NO HACER EN PRODUCCIÓN**

```sql
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
-- Hacer operaciones...
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
```

---

## 🧪 Comandos de Testing

### Crear Usuario de Prueba

```sql
-- Nota: Esto requiere acceso a auth.users, mejor hacerlo desde Supabase Dashboard
-- O usar el script de seed si existe
```

### Verificar Integridad de Datos

```sql
-- Usuarios sin perfil
SELECT COUNT(*) 
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- user_stats sin perfil
SELECT COUNT(*)
FROM user_stats us
LEFT JOIN profiles p ON us.id = p.id
WHERE p.id IS NULL;

-- food_logs sin usuario válido
SELECT COUNT(*)
FROM food_logs fl
LEFT JOIN profiles p ON fl.user_id = p.id
WHERE p.id IS NULL;
```

---

## 📝 Notas Importantes

1. **UUIDs:** Todos los IDs son UUIDs (v4). Reemplaza `'USER_UUID_AQUI'` con UUIDs reales.

2. **Fechas:** Usa formato `YYYY-MM-DD` para campos `day`. PostgreSQL maneja las zonas horarias automáticamente.

3. **RLS:** Todas las tablas tienen Row Level Security habilitado. Algunas consultas pueden requerir permisos de administrador.

4. **Backups:** Siempre haz backup antes de ejecutar comandos `DELETE` o `UPDATE` masivos.

5. **Niveles:** El campo `level` NO existe en BD, se calcula con `FLOOR(SQRT(xp_points / 100))`.

6. **Ranking:** El ranking oficial se ordena por `contribution_count DESC`, no por XP.

---

## 🚀 Comandos de Desarrollo

### Ejecutar Seed de Alimentos

```bash
# Asegúrate de tener las variables de entorno configuradas
npx tsx scripts/seedFoods.ts
```

### Verificar Conexión a Supabase

```bash
# Desde el proyecto
npm run start
# Luego verifica en la app que se conecta correctamente
```

### Limpiar Cache

```bash
# Limpiar cache de Expo
rm -rf node_modules/.cache .expo

# Reinstalar dependencias
npm install
```

---

## 📚 Referencias

- [Documentación de Supabase](https://supabase.com/docs)
- [PostgreSQL SQL Reference](https://www.postgresql.org/docs/)
- Ver también: `/docs/SUPABASE_REFERENCE.md` para esquema completo
- Ver también: `/docs/NAVIGATION_FLOW.md` para flujos de navegación

---

**⚠️ Advertencia:** Los comandos SQL en este documento son para referencia. Siempre prueba en un entorno de desarrollo antes de ejecutarlos en producción.
