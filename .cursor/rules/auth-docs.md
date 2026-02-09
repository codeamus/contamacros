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