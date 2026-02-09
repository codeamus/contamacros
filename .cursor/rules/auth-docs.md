# Documentación de app/(auth)/login.tsx

## Descripción General

Este archivo contiene el componente `LoginScreen` que maneja la autenticación del usuario mediante un formulario de inicio de sesión.
Provee campos para email y contraseña con validación, manejo de errores y soporte para inicio de sesión con Google y Apple.

---------------------

## Funciones Utilitarias

### translateAuthMessage
Traduce mensajes de error provenientes del backend a mensajes amigables en español para el usuario.

Parámetros:
- `msg` (string): Mensaje original del backend.

Retorna:
- Mensaje traducido (string) o null si no hay mensaje.

---------------------

## Componente LoginScreen

### Hooks y Estado
- `useAuth()`: Provee funciones para autenticación (`signIn`, `signInWithGoogle`, `signInWithApple`).
- `useTheme()`: Provee estilos temáticos (`colors`, `typography`).
- Estados:
  - `email`, `password`: Valores de inputs.
  - `showPassword`: Muestra/oculta la contraseña.
  - `touched`: Indica campos tocados para mostrar validaciones.
  - `loading`: Indica si se está procesando inicio de sesión.
  - `oauthLoading`: Indica si hay inicio con proveedor OAuth en proceso.
  - `formError`: Mensajes de error para mostrar.

### Validaciones
- Email válido y requerido.
- Contraseña con mínimo 6 caracteres y requerida.

### Funciones
- `onSubmit`: Maneja el envío del formulario con validación y llamada a `signIn`.
- `onGoogle`: Inicia login con Google y maneja errores.
- `onApple`: Inicia login con Apple y maneja errores.

### Animaciones y Estilos
- Animación de entrada con `Animated`.
- Estilos dinámicos basados en el tema actual.

### UI
- Logo en header.
- Campos con validación y feedback.
- Botones para login tradicional y OAuth.

---------------------

Esta documentación facilita la comprensión y mantenimiento del archivo login.tsx.

---------------------

## OAuth Google/Apple (Deep Links + Expo Router)

### Problema “Unmatched Route” (Android físico)
Cuando el login OAuth termina en el navegador, Android abre la app con el deep link de retorno (por ejemplo `contamacro://auth/callback?...`). Si Expo Router **no tiene** una ruta que matchee `/auth/callback`, muestra el error **“Unmatched Route”**.

### Ruta de captura (callback)
- **Archivo**: `app/auth/callback.tsx`
- **Ruta**: `/auth/callback`
- **UI**: Muestra un `ActivityIndicator` centrado.
- **Propósito**: Capturar el deep link para que Expo Router lo trate como ruta válida. El intercambio del `code` por sesión se hace en el provider de auth.

### Redirect URI moderno
En `src/presentation/hooks/auth/AuthProvider.tsx`, `getRedirectUri()` usa:
- `Linking.createURL("auth/callback")` (de `expo-linking`)

Resultado esperado:
- Builds/dev-client: `contamacro://auth/callback`
- (Si aplica) Expo Go: `exp://.../--/auth/callback`

### PKCE (Supabase)
El flujo recomendado en mobile es **PKCE**:
- Supabase devuelve un `code` en la URL de retorno.
- La app llama `supabase.auth.exchangeCodeForSession(code)` para obtener la sesión.
- Importante: el cliente Supabase debe tener `flowType: "pkce"` configurado en `src/data/supabase/supabaseClient.ts`.

### Configuración Expo (Android)
En `app.json`:
- **`expo.scheme`**: `"contamacro"`
- **`android.intentFilters`**: debe aceptar `scheme: "contamacro"` y categorías `BROWSABLE` + `DEFAULT` para que Android entregue el deep link a la app.