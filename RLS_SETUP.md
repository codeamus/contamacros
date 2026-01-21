# Configuración de Row Level Security (RLS) para Alimentos Comunitarios

## Problema

Al intentar crear un alimento comunitario, aparece el error:
```
new row violates row-level security policy for table "generic_foods"
```

Esto significa que las políticas RLS en Supabase están bloqueando la inserción de nuevos alimentos por parte de usuarios autenticados.

## Solución: Configurar Políticas RLS en Supabase

### 1. Habilitar RLS en la tabla `generic_foods`

En Supabase Dashboard → Table Editor → `generic_foods` → Settings → Row Level Security:
- Asegúrate de que RLS esté **habilitado** (ON)

### 2. Crear Política de INSERT para usuarios autenticados

Ve a **Authentication** → **Policies** → `generic_foods` → **New Policy**

**Política 1: Permitir INSERT a usuarios autenticados**

```sql
-- Nombre: "Allow authenticated users to insert community foods"
-- Operación: INSERT
-- Target roles: authenticated

CREATE POLICY "Allow authenticated users to insert community foods"
ON generic_foods
FOR INSERT
TO authenticated
WITH CHECK (true);
```

**Política 2: Permitir SELECT a todos (si no existe ya)**

```sql
-- Nombre: "Allow all users to read generic foods"
-- Operación: SELECT
-- Target roles: anon, authenticated

CREATE POLICY "Allow all users to read generic foods"
ON generic_foods
FOR SELECT
TO anon, authenticated
USING (true);
```

### 3. Verificar que las políticas estén activas

En Supabase Dashboard → Authentication → Policies → `generic_foods`, deberías ver:
- ✅ Una política de SELECT (para leer alimentos)
- ✅ Una política de INSERT (para crear alimentos comunitarios)

### 4. Opcional: Política para UPDATE (si quieres permitir ediciones)

```sql
-- Nombre: "Allow users to update their own contributions"
-- Operación: UPDATE
-- Target roles: authenticated

CREATE POLICY "Allow users to update their own contributions"
ON generic_foods
FOR UPDATE
TO authenticated
USING (true)  -- O puedes usar: created_by = auth.uid() si agregas ese campo
WITH CHECK (true);
```

## Nota sobre el campo `created_by`

Actualmente, la tabla `generic_foods` **no tiene** el campo `created_by` según el esquema. Si quieres rastrear quién creó cada alimento:

1. Agrega la columna en Supabase:
   ```sql
   ALTER TABLE generic_foods
   ADD COLUMN created_by UUID REFERENCES auth.users(id);
   ```

2. Actualiza la política de UPDATE para permitir ediciones solo del creador:
   ```sql
   CREATE POLICY "Allow users to update their own contributions"
   ON generic_foods
   FOR UPDATE
   TO authenticated
   USING (created_by = auth.uid())
   WITH CHECK (created_by = auth.uid());
   ```

3. Actualiza el código en `genericFoodsRepository.ts` para incluir `created_by` en el payload.

## Verificación

Después de configurar las políticas, prueba crear un alimento desde la app:
1. Busca un alimento que no exista
2. Presiona "Agregar a la comunidad"
3. Completa el formulario
4. Guarda

Deberías ver el mensaje: "¡Alimento creado! +50 XP ganados 🎉"
