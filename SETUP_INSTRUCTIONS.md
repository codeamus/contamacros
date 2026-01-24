# 🚀 Instrucciones de Configuración - Scanner de Macros por IA

## ✅ Verificación de Variables de Entorno

### 1. Verificar archivo `.env.local`
Asegúrate de que el archivo `.env.local` en la raíz del proyecto contenga:

```env
EXPO_PUBLIC_GEMINI_API_KEY="tu_api_key_aqui"
```

**Ubicación:** `/Users/alexanderurrutia/Documents/Proyectos/Personales/contamacro/.env.local`

### 2. Limpiar caché de variables de entorno

Después de modificar el archivo `.env.local`, **SIEMPRE** ejecuta:

```bash
npx expo start -c
```

El flag `-c` limpia la caché y recarga las variables de entorno.

### 3. Verificar que la API Key se carga correctamente

Al iniciar la app, revisa la consola. Deberías ver:
```
🔍 Verificando API Key: Cargada ✅
```

Si ves `VACÍA ❌`, significa que:
- El archivo `.env.local` no existe o está mal ubicado
- La variable no tiene el prefijo `EXPO_PUBLIC_`
- Necesitas reiniciar el servidor con `-c`

## 🔧 Corrección de Xcode Sandbox

Si encuentras errores de Sandbox en Xcode, sigue las instrucciones en:
**`XCODE_SANDBOX_FIX.md`**

## 🧪 Probar el Scanner

1. Abre la app
2. Ve a la pestaña de escaneo
3. Toca el icono de cerebro (🧠) para cambiar al modo IA
4. Toca el botón de captura (círculo blanco)
5. Toma una foto de un alimento
6. Espera el análisis (puede tardar 5-10 segundos)

## ⚠️ Solución de Problemas

### Error: "API Key no configurada"
- Verifica que `.env.local` existe y contiene `EXPO_PUBLIC_GEMINI_API_KEY`
- Ejecuta `npx expo start -c` para limpiar caché
- Reinicia el servidor de desarrollo

### Error: "404" o "Error de conexión"
- Verifica tu conexión a internet
- Asegúrate de que la API Key sea válida
- Revisa los logs en la consola para más detalles

### Error: "Sandbox" en Xcode
- Sigue las instrucciones en `XCODE_SANDBOX_FIX.md`
- Asegúrate de deshabilitar "User Script Sandboxing"
