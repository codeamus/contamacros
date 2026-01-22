# Políticas RLS para Supabase Storage - Bucket `avatars`

Este documento explica cómo configurar las políticas de seguridad (RLS) para el bucket `avatars` en Supabase Storage.

## 📋 Pasos para Configurar

### 1. Crear el Bucket `avatars`

1. Ve al Dashboard de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **Storage** en el menú lateral
4. Haz clic en **New bucket**
5. Configura:
   - **Name**: `avatars`
   - **Public bucket**: ✅ Activado (para que todos puedan leer avatares)
6. Haz clic en **Create bucket**

### 2. Aplicar las Políticas RLS

1. Ve al **SQL Editor** en el Dashboard de Supabase
2. Abre el archivo `supabase/storage-policies-avatars.sql` de este proyecto
3. Copia y pega el contenido en el SQL Editor
4. Haz clic en **Run** para ejecutar las políticas

### 3. Verificar las Políticas

Después de ejecutar el SQL, verifica que las políticas se crearon correctamente:

1. Ve a **Storage** → **Policies**
2. Filtra por bucket `avatars`
3. Deberías ver las siguientes políticas:
   - ✅ "Avatares son públicos para lectura" (SELECT)
   - ✅ "Usuarios autenticados pueden subir en avatars" (INSERT)
   - ✅ "Usuarios autenticados pueden actualizar en avatars" (UPDATE)
   - ✅ "Usuarios autenticados pueden eliminar en avatars" (DELETE)

## 🔒 Qué Hacen las Políticas

- **SELECT (Lectura)**: Todos pueden leer avatares (público)
- **INSERT (Subida)**: Solo usuarios autenticados pueden subir archivos
- **UPDATE (Actualización)**: Solo usuarios autenticados pueden actualizar archivos
- **DELETE (Eliminación)**: Solo usuarios autenticados pueden eliminar archivos

## ⚠️ Nota Importante

Las políticas actuales permiten que cualquier usuario autenticado suba/actualice/elimine cualquier archivo en el bucket `avatars`. Esto es seguro porque:

1. Los archivos se nombran como `${userId}_avatar.jpg`, por lo que cada usuario solo puede sobrescribir su propio avatar
2. Si necesitas más seguridad, puedes usar las políticas más restrictivas que verifican el nombre del archivo (comentadas en el SQL)

## 🧪 Probar las Políticas

Después de aplicar las políticas, prueba subiendo un avatar desde la app. Si hay errores de permisos, verifica:

1. Que el bucket `avatars` existe y es público
2. Que las políticas se aplicaron correctamente
3. Que el usuario está autenticado (tiene una sesión activa)
