# Documentación de archivs de Autenticación

Esta documentación cubre los detalles y funcionalidades claves de los archivos bajo la ruta `app/(auth)/`.

## reset-password.tsx
- Pantalla para restablecer contraseña cuando el usuario ha olvidado la suya.
- Recibe el email como parámetro de búsqueda y permite ingresar un código OTP para validación.
- Permite ingresar nueva contraseña y confirmarla.
- Verifica el OTP y actualiza la contraseña usando Supabase.
- Muestra toasts para feedback de errores o éxitos.
- Redirige a login tras cambio exitoso.

## forgot-password.tsx
- Pantalla para solicitar envío de código OTP para recuperación de contraseña.
- El usuario ingresa su email.
- Se valida formato de email y se usa Supabase para enviar código OTP.
- Muestra mensajes y redirige a reset-password con email para continuar flujo.

## login.tsx
- Pantalla de inicio de sesión con email y contraseña.
- Define validaciones para email y nivel de seguridad de contraseña.
- Implementa login con métodos tradicionales, Google y Apple.
- Maneja errores específicos traducidos a mensajes amigables.
- Contiene animación de entrada para UI suave.

## register.tsx
- Pantalla para crear nueva cuenta.
- Campos para email, contraseña y confirmar contraseña.
- Valida email, seguridad de contraseña y coincidencia de contraseñas.
- Envía datos a método de creación de cuenta, maneja errores.
- Redirige a pantalla para verificación por OTP al crear cuenta.

## verify-otp.tsx
- Pantalla para ingresar código OTP enviado para confirmar cuenta.
- Valida que el código sea de 6 dígitos.
- Envía verificación a Supabase.
- Muestra mensajes acorde a éxito o error.
- Confirma cuenta y permite avanzar tras verificación.

---

Esta documentación está disponible en `.cursor/rules/auth-docs.md` y se debe consultar cada vez que se requiera información sobre los archivos de autenticación.
