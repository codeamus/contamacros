# Políticas RLS para la tabla `user_favorites`

Este documento explica cómo configurar las políticas de seguridad (RLS) para la tabla `user_favorites` en Supabase.

## 📋 Pasos para Configurar

### 1. Aplicar las Políticas RLS

1. Ve al Dashboard de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve al **SQL Editor** en el Dashboard de Supabase
4. Abre el archivo `supabase/migrations/user_favorites_rls.sql` de este proyecto
5. Copia y pega el contenido en el SQL Editor
6. Haz clic en **Run** para ejecutar las políticas

### 2. Verificar las Políticas

Después de ejecutar el SQL, verifica que las políticas se crearon correctamente:

1. Ve a **Authentication** → **Policies** (o **Table Editor** → `user_favorites` → **Policies**)
2. Filtra por tabla `user_favorites`
3. Deberías ver las siguientes políticas:
   - ✅ "Users can view their own favorites" (SELECT)
   - ✅ "Users can insert their own favorites" (INSERT)
   - ✅ "Users can delete their own favorites" (DELETE)

## 🔒 Qué Hacen las Políticas

- **SELECT (Lectura)**: Los usuarios solo pueden ver sus propios favoritos
  - Condición: `auth.uid() = user_id`
  
- **INSERT (Inserción)**: Los usuarios solo pueden insertar favoritos para sí mismos
  - Condición: `auth.uid() = user_id` (verificado en `WITH CHECK`)
  
- **DELETE (Eliminación)**: Los usuarios solo pueden eliminar sus propios favoritos
  - Condición: `auth.uid() = user_id`

## ⚠️ Nota Importante

- **RLS debe estar habilitado**: La tabla `user_favorites` debe tener RLS activado para que las políticas funcionen
- **Autenticación requerida**: Todas las operaciones requieren que el usuario esté autenticado
- **Sin UPDATE**: No se necesita política para UPDATE ya que la tabla no tiene campos editables

## 🧪 Probar las Políticas

Después de aplicar las políticas, prueba desde la app:

1. **Agregar favorito**: Debería funcionar sin errores
2. **Ver favoritos**: Solo deberías ver tus propios favoritos
3. **Eliminar favorito**: Solo deberías poder eliminar tus propios favoritos

Si hay errores de permisos, verifica:
1. Que RLS está habilitado en la tabla `user_favorites`
2. Que las políticas se aplicaron correctamente
3. Que el usuario está autenticado (tiene una sesión activa)
4. Que el `user_id` en la inserción coincide con `auth.uid()`

## 🔧 Solución de Problemas

### Error: "new rows violates row-level security"

Este error ocurre cuando:
- RLS está habilitado pero no hay políticas que permitan la inserción
- La política de INSERT no está correctamente configurada
- El `user_id` en la inserción no coincide con `auth.uid()`

**Solución**: Ejecuta el archivo SQL `supabase/migrations/user_favorites_rls.sql` para crear las políticas necesarias.
