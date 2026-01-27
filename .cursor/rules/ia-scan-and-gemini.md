# IA Scan y uso de Gemini – Documentación

> **Uso:** Para cambios en "IA Scan", "Escaneo por IA" o en integraciones con **Gemini** (p. ej. futuro **chat de agente de IA**), consultar este documento. Reutilizar siempre el mismo servicio/capas y **actualizar esta documentación** al cambiar lógica o agregar nuevos consumos de la API.

---

## 1. Resumen

**IA Scan** (Escaneo por IA) permite al usuario tomar una foto de un alimento y obtener un análisis de macros (nombre, calorías, proteína, carbos, grasas, porción) usando **Google Gemini**. El resultado se confirma en un modal y se guarda en `food_logs` con `source: "ai_scan"`. La versión gratuita está limitada a **3 escaneos por día**; Premium tiene uso ilimitado.

Este documento describe la lógica actual y, en la **sección 6**, cómo **reutilizar credenciales, servicio y patrones** para otras features (p. ej. un **chat de agente de IA** que también use Gemini).

---

## 2. Archivos involucrados

| Archivo | Rol |
|--------|-----|
| `src/data/ai/geminiService.ts` | **Único punto de llamada a la API de Gemini.** Credencial, URL del modelo, `analyzeFoodImage(base64)`, parsing de respuesta, reintentos y manejo de 429/red. |
| `src/core/config/env.ts` | Expone `env.geminiApiKey` desde `process.env.EXPO_PUBLIC_GEMINI_API_KEY`. |
| `src/domain/services/scanLimitService.ts` | Límite diario: `getTodayScanCount`, `incrementScanCount`, `canScanToday`, `getRemainingScans`, `getDailyLimit` (3). Storage key: `StorageKeys.AI_SCAN_DAILY_LIMIT`. |
| `src/core/storage/keys.ts` | `AI_SCAN_DAILY_LIMIT: "ai_scan_daily_limit"`. |
| `src/presentation/hooks/scanner/useMacroScanner.ts` | Orquesta: permisos cámara → captura → compresión imagen → llamada a `analyzeFoodImage` → límite (si no premium) → callbacks. |
| `app/(tabs)/scan.tsx` | Pantalla scanner: modo código de barras vs modo IA; usa `useMacroScanner`, `ScannerOverlay`, `ConfirmMacroModal`, paywall. |
| `src/presentation/components/scanner/ScannerOverlay.tsx` | UI overlay en modo IA: frame, animación de escaneo, texto "Analizando..."/"Reintentando...". |
| `src/presentation/components/scanner/ConfirmMacroModal.tsx` | Modal post-análisis: muestra `MacroAnalysisResult`, permite editar gramos, calcula macros y llama `foodLogRepository.create` con `source: "ai_scan"`. |
| `app/(tabs)/add-food.tsx` | Botón "Escanear con IA" que navega a `/(tabs)/scan` con `params: { meal, mode: "ai" }`. |
| `src/core/errors/AppError.ts` | `AppError`, `ErrorCode` (VALIDATION_ERROR, NETWORK_ERROR, SERVER_ERROR, etc.) usados por `geminiService`. |
| `src/core/errors/errorHandler.ts` | `getErrorMessage(error)` usado en `useMacroScanner` para mensajes de toast. |

---

## 3. Credenciales y configuración

- **Variable de entorno:** `EXPO_PUBLIC_GEMINI_API_KEY`
- **Dónde se usa:** En `geminiService.ts` se lee con `process.env.EXPO_PUBLIC_GEMINI_API_KEY`. En `env.ts` está expuesta como `env.geminiApiKey` (por si en el futuro se centraliza el uso).
- **API utilizada:** Google Generative AI (Gemini), endpoint:  
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`
- **Modelo:** `gemini-flash-latest` (alias estable).

Para un **nuevo consumo** (p. ej. chat): usar la **misma API key**; opcionalmente leer desde `env.geminiApiKey` en lugar de `process.env` para mantener un solo punto de configuración.

---

## 4. Servicio Gemini (`src/data/ai/geminiService.ts`)

### 4.1 Contrato actual

- **Función exportada:** `analyzeFoodImage(base64Image: string): Promise<MacroAnalysisResult>`
- **Tipo exportado:**  
  `MacroAnalysisResult = { foodName, calories, protein, carbs, fats, servingSize }`

### 4.2 Flujo interno

1. **Validación:** Si no hay `API_KEY`, lanza `AppError("API Key no configurada", ErrorCode.VALIDATION_ERROR)`.
2. **Normalizar base64:** Quita prefijo `data:image/...;base64,` si existe (`normalizeBase64`).
3. **Payload:** Un solo `contents[0].parts`: primero un `text` (prompt de nutricionista chileno + instrucción de responder solo JSON con los campos indicados), luego `inlineData` con `mimeType: "image/jpeg"` y `data: normalizedBase64`.
4. **Headers:** `Content-Type: application/json`, `x-goog-api-client: expo-react-native/1.0`.
5. **Reintentos:** Hasta 2 intentos (3 llamadas en total). En **429 / RESOURCE_EXHAUSTED / Quota exceeded** se parsea `retryDelay` del payload (Google RetryInfo) y se espera ese tiempo (+1s) antes de reintentar; si sigue fallando se lanza `AppError` con mensaje amigable. En errores de **red** (Network, fetch, timeout) se espera 2s y se reintenta; al final se lanza `AppError` de red.
6. **Respuesta:** Se espera `data.candidates[0].content.parts[0].text`. Se limpia (quitar ```json/```), se extrae el JSON con un regex `\{[\s\S]*\}`, se parsea y se valida/mapea a `MacroAnalysisResult` (números con `Number()`, strings por defecto).

### 4.3 Reutilización para chat u otros usos

El archivo actual está orientado a **una sola operación** (`analyzeFoodImage`). Para un **chat de agente de IA** (o cualquier otro uso de Gemini) se recomienda:

- **Opción A – Extender el mismo archivo:** Añadir en `geminiService.ts` una función genérica, por ejemplo `generateContent(options: { contents: ... })`, que:
  - Use la misma `API_KEY` y base `API_URL` (o una variante por modelo si se quiere otra versión).
  - Reutilice el mismo patrón de `fetch`, headers, manejo de 429/red y reintentos.
  - Devuelva el texto (o la estructura que necesite el chat) en lugar de parsear un JSON fijo.

- **Opción B – Módulo compartido de “cliente Gemini”:** Extraer en un pequeño cliente (`getApiKey()`, `postGenerateContent(body)`, lógica de retry/429) y que tanto `analyzeFoodImage` como el futuro chat llamen a ese cliente. Así las credenciales y la política de reintentos quedan en un solo lugar.

En ambos casos, **no duplicar** la lectura de `EXPO_PUBLIC_GEMINI_API_KEY` ni la lógica de reintentos en otro archivo; reutilizar o refactorizar dentro de `src/data/ai/`.

---

## 5. Lógica del IA Scan (flujo completo)

### 5.1 Entrada a la pantalla de escaneo IA

- **Add-food:** Botón "Escanear con IA" → `router.push({ pathname: "/(tabs)/scan", params: { meal, mode: "ai" } })`.
- **Scan:** `params.mode === "ai"` pone `scanMode` en `"ai"` (por defecto es `"barcode"`). El usuario también puede cambiar entre modos con el botón en la barra (toggle barcode ↔ IA).

### 5.2 Hook `useMacroScanner`

- **Opciones:** `onAnalysisComplete?(result)`, `onLimitReached?()`.
- **Estado:** `isAnalyzing`, `isRetrying`, `analysisResult`, y un lock global `isAnalyzingInFlight` para evitar doble tap.
- **Flujo de `captureAndAnalyze`:**
  1. Si no es premium: `canScanToday()`; si false → llama `onLimitReached?.()` y sale (no incrementa contador).
  2. Permisos cámara con `ImagePicker.requestCameraPermissionsAsync()`; si no granted, throw.
  3. `ImagePicker.launchCameraAsync({ mediaTypes: "images", allowsEditing: false, quality: 0.8, base64: true })`.
  4. Compresión: `ImageManipulator.manipulateAsync(uri, [{ resize: { width: 512 } }], { compress: 0.3, format: JPEG, base64: true })` para reducir tokens.
  5. Llamada a `analyzeFoodImage(base64)`. Si tarda > 4 s se pone `isRetrying` para mostrar "Reintentando..." en el overlay.
  6. Si OK: `setAnalysisResult(result)`, si no premium `incrementScanCount()`, luego `onAnalysisComplete?.(result)`.
  7. Errores: se clasifican (API Key, 429/quota, red) y se muestra toast con `showToast`; no se incrementa el contador.
- **resetAnalysis:** Limpia resultado y flags.

### 5.3 Límite diario (`scanLimitService`)

- **Storage:** JSON `{ date: "YYYY-MM-DD", count: number }` en `StorageKeys.AI_SCAN_DAILY_LIMIT`.
- **Límite:** 3 por día. Si `date` no es hoy, el contador se considera 0.
- **Premium:** No se llama `canScanToday` ni `incrementScanCount` cuando `isPremium` es true (useMacroScanner usa `usePremium()`).

### 5.4 Pantalla Scan (`scan.tsx`)

- Modo IA: no se activa el lector de códigos; se muestra `ScannerOverlay` con `isScanning={isAnalyzing}`, `isRetrying={isRetrying}` y un botón de disparo que llama `captureAndAnalyze`.
- Al completar análisis: `onAnalysisComplete` abre el modal de confirmación (`setShowConfirmModal(true)`).
- Límite: `onLimitReached` muestra un `Alert` con opción "Ver Premium" que abre el paywall.
- `useFocusEffect`: al enfocar la pantalla se resetea `scanned`, `lockRef`, `resetAnalysis()` y se cierra el modal.

### 5.5 Modal de confirmación (`ConfirmMacroModal`)

- Recibe `visible`, `onClose`, `onSuccess`, `analysisResult` (`MacroAnalysisResult | null`), `meal`.
- Gramos por defecto: parsea `servingSize` (ej. "400g" → 400); si no hay número, 100.
- Calcula macros para la porción: `factor = grams / defaultGrams`; aplica a calorías y macros del resultado.
- Al guardar: `foodLogRepository.create({ day, meal, name: foodName, grams, calories, protein_g, carbs_g, fat_g, source: "ai_scan", source_type: "manual", ... })`. Luego toast, `onSuccess`, `onClose`.
- Validación guardar: gramos entre 1 y 2000.

### 5.6 Registro en food_logs

- Campos relevantes para IA Scan: `source: "ai_scan"`, `source_type: "manual"`. El resto según modelo de `foodLogRepository.create` (day, meal, name, grams, calories, protein_g, carbs_g, fat_g; opcionales source, off_id, source_type, food_id, user_food_id).

---

## 6. Reutilización para chat de agente de IA (y otros usos de Gemini)

Objetivo: que un futuro **chat de agente de IA** use la **misma API de Gemini**, **mismas credenciales** y **mismo tipo de robustez** (reintentos, 429, red) sin duplicar código.

### 6.1 Credenciales

- Una sola variable: `EXPO_PUBLIC_GEMINI_API_KEY`.
- Preferible leer desde `env.geminiApiKey` en todo el código que use Gemini (refactor opcional en `geminiService.ts` para usar `env.geminiApiKey` en lugar de `process.env` directo).

### 6.2 Servicio / API

- **Ubicación:** `src/data/ai/geminiService.ts` (o un nuevo `src/data/ai/geminiClient.ts` si se factoriza).
- **Reutilizar:**
  - URL base y modelo (o parametrizar modelo).
  - Headers (`Content-Type`, `x-goog-api-client`).
  - Lógica de reintentos (maxRetries, 429 + retryDelay, errores de red).
  - Uso de `AppError` y `ErrorCode` para errores conocidos.
- **Añadir:** Una función de “contenido libre”, por ejemplo:
  - `generateContent(params: { contents: Array<{ role?: string; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }> })`  
  que envíe POST al mismo (u otro) modelo y devuelva el texto de la respuesta, reutilizando la misma clave y la misma política de fetch/retry.

### 6.3 Límites y uso

- El límite de 3 escaneos/día y `scanLimitService` son **solo para IA Scan**. Un chat puede tener su propia política (p. ej. límite de mensajes, o solo premium) sin tocar `scanLimitService`; si en el futuro se unifica “uso de IA” en un solo límite, se puede extender la capa de dominio y storage en un módulo compartido.

### 6.4 Resumen práctico para implementar el chat

1. Usar **la misma** `EXPO_PUBLIC_GEMINI_API_KEY` (y si se refactoriza, `env.geminiApiKey`).
2. En `src/data/ai/` añadir una función genérica de llamada a Gemini (o un cliente compartido) que reutilice URL, headers y reintentos; el chat solo arma `contents` (mensajes de usuario/asesor) y opcionalmente imágenes.
3. Manejar errores con `AppError` / `ErrorCode` y mensajes amigables (como en `geminiService` y `useMacroScanner`).
4. No reescribir la lógica de 429/red en el chat; llamar al mismo módulo de datos.

Al hacer esto, cualquier ajuste futuro a credenciales, modelo o política de reintentos se hace en un solo lugar y esta documentación debe actualizarse con los nuevos flujos (p. ej. “Chat de agente: llama a `geminiService.generateChat(...)`”).

---

## 7. Consideraciones para cambios futuros

- **Modelo de Gemini:** Cambiar `gemini-flash-latest` solo en `geminiService.ts` (const `API_URL` o constante de modelo).
- **Prompt de análisis de imagen:** Está en el `text` del primer `part` en el payload de `analyzeFoodImage`; modificar ahí para cambios de copy o de formato JSON.
- **Límite diario:** Constante `DAILY_LIMIT = 3` y lógica en `scanLimitService.ts`; si se añade un límite “global de IA”, conviene documentarlo aquí y reutilizar storage/keys sin duplicar.
- **Permisos y compresión:** Reglas de cámara y parámetros de compresión (512px, 0.3) viven en `useMacroScanner`; si se usa imagen desde el chat (ej. galería), se puede reutilizar `normalizeBase64` y la misma compresión para ahorro de tokens.

---

**Última actualización:** Enero 2025.  
Al modificar IA Scan o cualquier consumo de Gemini (incl. futuro chat de agente), actualizar este archivo.
