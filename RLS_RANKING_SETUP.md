# Configuración RLS para Ranking (Top Creadores)

Este documento explica cómo configurar las políticas de Row Level Security (RLS) en Supabase para que el ranking funcione correctamente.

## Problema

El ranking necesita leer datos de las tablas `user_stats` y `profiles` para mostrar:
- Número de aportes (`contribution_count`)
- Nombres de usuarios (`full_name`)
- Estado premium (`is_premium`)
- XP y otros stats

Si no hay políticas RLS configuradas, la consulta devolverá un array vacío `[]`.

## Solución: Políticas RLS

### 1. Habilitar RLS en las tablas

```sql
-- Habilitar RLS en user_stats
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### 2. Política para leer user_stats (público)

Permite que cualquier usuario autenticado pueda leer las estadísticas de otros usuarios para el ranking:

```sql
-- Política SELECT para user_stats
CREATE POLICY "Cualquier usuario puede leer stats para ranking"
ON user_stats
FOR SELECT
TO authenticated
USING (true);
```

**Nota:** Esta política permite que cualquier usuario autenticado vea las stats de otros. Si prefieres restringir más, puedes usar:

```sql
-- Alternativa: Solo ver stats de usuarios con contribution_count > 0
CREATE POLICY "Ver stats de usuarios activos"
ON user_stats
FOR SELECT
TO authenticated
USING (contribution_count > 0 OR user_id = auth.uid());
```

### 3. Política para leer profiles (público)

Permite que cualquier usuario autenticado pueda leer nombres y estado premium de otros usuarios:

```sql
-- Política SELECT para profiles (solo campos públicos)
CREATE POLICY "Cualquier usuario puede leer perfiles públicos"
ON profiles
FOR SELECT
TO authenticated
USING (true);
```

**Nota:** Si quieres ocultar emails o datos sensibles, puedes crear una vista o función que solo exponga `full_name` e `is_premium`.

### 4. Política para actualizar user_stats (solo propio)

Los usuarios solo pueden actualizar sus propias stats:

```sql
-- Política UPDATE para user_stats
CREATE POLICY "Usuarios pueden actualizar sus propias stats"
ON user_stats
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

### 5. Política para insertar user_stats (solo propio)

Los usuarios solo pueden crear sus propias stats:

```sql
-- Política INSERT para user_stats
CREATE POLICY "Usuarios pueden crear sus propias stats"
ON user_stats
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
```

## Verificación

Después de aplicar estas políticas, verifica en los logs de la app:

1. **Si el array viene vacío:**
   ```
   [GamificationService] 📊 Resultado de getLeaderboard: { dataLength: 0 }
   ```
   → Probablemente falta una política RLS

2. **Si hay un error:**
   ```
   [GamificationService] ❌ Error en getLeaderboard: { message: "...", code: "..." }
   ```
   → Revisa el código de error en la documentación de Supabase

3. **Si funciona correctamente:**
   ```
   [GamificationService] ✅ Entradas procesadas: 10
   ```
   → El ranking debería mostrar usuarios

## Alternativa: Función SQL

Si prefieres más control, puedes crear una función SQL que maneje el ranking:

```sql
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  xp_points INTEGER,
  level INTEGER,
  daily_streak INTEGER,
  contribution_count INTEGER,
  is_premium BOOLEAN,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.user_id,
    p.full_name,
    p.email,
    us.xp_points,
    us.level,
    us.daily_streak,
    us.contribution_count,
    COALESCE(p.is_premium, false) as is_premium,
    ROW_NUMBER() OVER (ORDER BY us.contribution_count DESC)::INTEGER as rank
  FROM user_stats us
  LEFT JOIN profiles p ON p.id = us.user_id
  ORDER BY us.contribution_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Política para ejecutar la función
GRANT EXECUTE ON FUNCTION get_leaderboard(INTEGER) TO authenticated;
```

Luego en el código, llamarías a esta función en lugar de hacer el SELECT directo.

## Notas de Seguridad

- **Datos sensibles:** Asegúrate de que solo expones los campos necesarios (`full_name`, `is_premium`, stats públicas)
- **Email:** Considera ocultar o enmascarar emails en el ranking
- **Rate limiting:** El ranking es una consulta costosa, considera cachear los resultados
