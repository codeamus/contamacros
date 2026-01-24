# 🔧 Corrección de Error de Sandbox en Xcode

## Problema
Error de Sandbox en Xcode que impide la ejecución correcta de la aplicación.

## Solución

### Paso 1: Abrir el proyecto en Xcode
1. Abre Xcode
2. Navega a tu proyecto: `ios/contamacro.xcworkspace` (o `.xcodeproj`)

### Paso 2: Modificar Build Settings
1. En el navegador de proyectos (panel izquierdo), selecciona el proyecto **contamacro**
2. Selecciona el **target** "contamacro" (no el proyecto, sino el target)
3. Ve a la pestaña **"Build Settings"** (en la parte superior)
4. En la barra de búsqueda, escribe: **"User Script Sandboxing"**
5. Encuentra la opción **"Enable User Script Sandboxing"**
6. Cambia el valor de **"Yes"** a **"No"**

### Paso 3: Limpiar y reconstruir
1. En Xcode, ve a **Product > Clean Build Folder** (o presiona `Cmd + Shift + K`)
2. Cierra Xcode
3. En la terminal, ejecuta:
   ```bash
   cd ios
   rm -rf build
   cd ..
   npx expo prebuild --clean
   ```

### Paso 4: Reconstruir la app
```bash
npx expo run:ios
```

## Nota
Si el error persiste, también verifica que:
- **"Allow Unsigned Executables"** esté habilitado en Build Settings
- Los permisos de cámara estén correctamente configurados en `Info.plist`
