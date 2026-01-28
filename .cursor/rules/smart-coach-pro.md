# Smart Coach Pro – Documentación Completa

> **Uso:** Cuando el usuario pida cambios o mencione "Smart Coach Pro", consultar este documento, aplicar los cambios en el código y **actualizar esta documentación** con los nuevos comportamientos o archivos tocados.

---

## 1. Resumen y propósito

**Smart Coach Pro** es una funcionalidad **solo premium** que analiza el progreso diario del usuario (calorías y macros consumidos vs. metas) y muestra **una única recomendación** por vez:

- **Escenario A (macro):** Faltan calorías y faltan macros → recomienda **comer un alimento** para priorizar el macro más deficitario.
- **Escenario B (caloría):** Faltan calorías pero los macros están al día → recomienda **comer un alimento** para completar calorías.
- **Escenario C (ejercicio):** Hay superávit calórico → recomienda **ejercicio(s)** para "quemar" el exceso (considerando actividad ya registrada en Apple Health / Health Connect si es premium).

**Características principales:**

- **Refinamiento con IA:** El usuario puede chatear con el coach para pedir alternativas o modificaciones a la recomendación usando Gemini 2.5 Flash.
- **Pantalla completa:** Navegación a pantalla dedicada (`/smart-coach-pro`) con chat interactivo y vista detallada.
- **Recetas generadas:** Las recomendaciones refinadas por IA incluyen ingredientes e instrucciones, navegables a `/recipe-detail`.
- **Quick Add:** Agregar la comida recomendada al día con un toque desde Home o la pantalla completa.

---

## 2. Arquitectura y archivos

### 2.1 Archivos principales

| Archivo                                                    | Rol                                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/models/smartCoach.ts`                          | Tipos: `SmartCoachRecommendation`, `MacroRecommendation`, `CalorieRecommendation`, `ExerciseRecommendation`, `SmartCoachState`.          |
| `src/presentation/hooks/smartCoach/useSmartCoachPro.ts`    | Lógica core: cálculo de gaps, selección de escenario, búsqueda de alimentos, cálculo de minutos de ejercicio, mensajes.                  |
| `src/presentation/components/smartCoach/SmartCoachPro.tsx` | Componente UI para Home: estados (no premium, loading, sin recomendación, ejercicio, comida), Quick Add, sincronización Health, paywall. |
| `app/smart-coach-pro.tsx`                                  | **Pantalla completa** con chat de refinamiento, vista detallada de recomendación, navegación a receta.                                   |
| `app/recipe-detail.tsx`                                    | Pantalla de detalle de receta generada por IA: ingredientes (checklist), instrucciones (pasos numerados), macros.                        |
| `app/(tabs)/home.tsx`                                      | Integración en Home: llama `useSmartCoachPro`, renderiza `<SmartCoachPro>`, navega a pantalla completa.                                  |
| `app/(tabs)/about-smart-coach-pro.tsx`                     | Pantalla informativa "¿Cómo funciona el Smart Coach Pro?"; navegación desde enlace en tarjeta no premium.                                |
| `src/presentation/state/smartCoachRecommendationStore.ts`  | Store Zustand: `recommendation`, `successCaloriesBurned`, acciones para set/clear/openSuccessScreen.                                     |
| `src/data/ai/geminiService.ts`                             | `askSmartCoach()`: función que usa Gemini 2.5 Flash para generar alternativas de comida con receta completa.                             |

### 2.2 Repositorios/servicios usados

- `foodLogRepository`: `getUniqueFoodsFromHistory(30)`, `create(...)` (Quick Add).
- `genericFoodsRepository`: `searchByTags(tags, 50)`, `getAllForSmartSearch()`.
- `userFoodsRepository`: `getAllForSmartSearch()`.
- `activityLogRepository`: `getTodayCalories(day)` (solo premium, escenario C).
- `exercisesRepository`: `listAll()` (escenario C).

---

## 3. Modelo de datos (`src/domain/models/smartCoach.ts`)

### 3.1 Tipos principales

- **SmartCoachRecommendation** = `MacroRecommendation | CalorieRecommendation | ExerciseRecommendation`.
- **MacroRecommendation** (escenario A): `type: "macro"`, `priorityMacro`, `message`, `recommendedFood`, `macroGaps` (gap/consumed/target por proteína, carbos, grasa, calorías).
- **CalorieRecommendation** (escenario B): `type: "calorie"`, `message`, `recommendedFood`, `calorieGap`.
- **ExerciseRecommendation** (escenario C): `type: "exercise"`, `message`, `exercises[]` (cada uno: `exercise` + `minutesNeeded`), `excessCalories`, opcionalmente `activityCaloriesBurned` y `remainingExcess`.
- **SmartCoachState**: `recommendation`, `loading`, `error`, `reload`.

### 3.2 Estructura de `recommendedFood`

```typescript
{
  name: string;
  source: "history" | "generic" | "user_food";
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  kcal_100g: number;
  recommendedAmount: number; // Gramos o unidades recomendadas
  unitLabel?: string;
  lastEaten?: string;
  timesEaten?: number;
  // Campos opcionales para recetas generadas por IA:
  ingredients?: string[];
  instructions?: string[];
  image_description?: string;
  image_search_term?: string;
}
```

---

## 4. Lógica del hook (`useSmartCoachPro`)

### 4.1 Parámetros

- `profile` (ProfileDb | null): peso (`weight_kg`), metas de macros (`protein_g`, `carbs_g`, `fat_g`), `dietary_preference`.
- `caloriesTarget`: meta de calorías del día (en Home se pasa `effectiveTargetForCoach` = target + calorías quemadas si premium).
- `caloriesConsumed`, `proteinConsumed`, `carbsConsumed`, `fatConsumed`: totales del día (p. ej. desde `useTodaySummary`).
- `isPremium`: si es false, no se calcula recomendación (se deja `recommendation` en null).

### 4.2 Condiciones de salida temprana (no recomendación)

- No premium.
- `profile?.weight_kg` ausente o ≤ 0.
- Metas no configuradas: `caloriesTarget` o cualquier macro target ≤ 0.
- **Datos aún no cargados:** todos los consumos en 0 (`caloriesConsumed`, protein, carbs, fat) → no ejecutar para evitar recomendaciones incorrectas al refrescar.
- **Déficit calórico muy pequeño:** `caloriesGap <= 10` (después de evaluar que no hay superávit).

### 4.3 Orden de evaluación de escenarios

1. **Superávit** (`consumed > target`) → **Siempre** Escenario C (ejercicio). Si no hay superávit, se evalúa déficit.
2. **Déficit** y **gaps de macros** (protein/carbs/fat gap > 5)\*\* → Escenario A (macro).
3. **Déficit** y macros al día → Escenario B (caloría).

### 4.4 Escenario C – Ejercicio (superávit)

- `excessCalories = consumed - target`.
- Si **premium:** se llama `activityLogRepository.getTodayCalories(todayStrLocal())`.
  - `remainingExcess = max(0, excessCalories - activityCaloriesBurned)`.
  - Si `remainingExcess <= 0` y hubo actividad, **no se muestra recomendación** (el coach considera que ya está equilibrado).
- Se obtienen ejercicios con `exercisesRepository.listAll()`.
- **Filtro por hora:**
  - Noche (hour >= 20 o < 5): solo MET entre 2 y 4.5.
  - Resto del día: MET >= 2.
- Se eligen hasta **2 ejercicios** aleatorios entre los filtrados. Para cada uno:
  - **Minutos para quemar:** `(remainingExcess * 200) / (MET * 3.5 * weight_kg)`, mínimo 1 minuto, redondeado a 1 decimal.
- Mensaje según franja horaria (mañana / tarde / noche) y si hay `activityCaloriesBurned`.
- Se devuelve `ExerciseRecommendation` con `excessCalories` (original), y opcionalmente `activityCaloriesBurned` y `remainingExcess`.

### 4.5 Escenario A – Macro (déficit + gaps de macros)

- **Macro prioritario:** el que tiene mayor déficit porcentual respecto a su meta (proteína, carbos o grasa).
- **Búsqueda de alimento:** `findPerfectFoodMatch(gaps, priorityMacro, caloriesGap, dietaryPreference)`.
- **Cantidad recomendada:** `calculateRecommendedAmount(food, priorityMacro, priorityGap * 0.7, caloriesGap)` → se intenta cubrir ~70% del déficit del macro prioritario, respetando un tope de calorías (hasta ~110% de `caloriesGap`).
- Mensaje según origen del alimento (historial con "lo comiste hace X días", receta propia, o genérico).
- Formato de cantidad: si hay `gramsPerUnit` y `unitLabel`, se muestra en unidades (incl. fracciones 1/4, 1/2, 3/4); si no, en gramos.

### 4.6 Escenario B – Caloría (déficit, macros al día)

- `findPerfectFoodMatch` con prioridad `"calories"` y gap de calorías.
- `calculateRecommendedAmount(food, "calories", caloriesGap * 0.8)` → cubrir ~80% del déficit calórico.
- Mismo formato de cantidad y mensaje según historial/genérico.

### 4.7 Búsqueda de alimentos (`findPerfectFoodMatch`)

- **Fuentes en orden consideradas para armar la lista:**
  1. **user_foods** (`getAllForSmartSearch`): se normalizan a base 100g con `portion_base`.
  2. **Historial** (`getUniqueFoodsFromHistory(30)`): últimos 30 días.
  3. **generic_foods** (`searchByTags`): tags según macro prioritario (proteína: "protein"/"proteina"; carbs: "carb"/"carbohidrato"/"fruit"; fat: "fat"/"grasa"/"dairy"; calories: mismo criterio).
- **Filtro por preferencia dietética:** Se excluyen alimentos que no coinciden con `dietary_preference` (vegan, vegetarian, pescatarian) usando keywords de carne/pescado/lácteos.
- Se excluyen alimentos de **bajo aporte**: p. ej. kcal_100g < 30 (o < 50 para calorías), o densidad baja del macro prioritario; y una lista fija de nombres (zanahoria, lechuga, apio, etc.).
- **Ordenación:** primero historial, luego por densidad del macro prioritario (mayor primero).
- Se devuelve el **primer** candidato (mejor match).

### 4.8 Cálculos auxiliares

- **Minutos para quemar calorías (MET):**
  `minutes = (excessCalories * 200) / (MET * 3.5 * weight_kg)`, mín 1, redondeado a 1 decimal.
- **Cantidad recomendada (gramos):**
  `gramsNeeded = (targetValue * 100) / macroValue` (macroValue = valor del macro o kcal por 100g). Si se pasa `maxCalories`, se limita para no exceder ~110% de ese límite.

### 4.9 Cuándo se ejecuta el hook

- **useEffect** cuando cambian `fetchRecommendation` y los consumos (calories, protein, carbs, fat); solo si hay "datos reales" (al menos un consumo > 0).
- **useFocusEffect** al recibir foco la pantalla (ej. volver al Home): resetea `isProcessingRef` y `lastExecutionDataRef`, luego llama `fetchRecommendation` si hay datos reales.
- Evita dobles ejecuciones con los mismos datos usando `lastExecutionDataRef` (comparando `caloriesConsumed` y `caloriesTarget`).

---

## 5. Refinamiento con IA (`askSmartCoach` en `geminiService.ts`)

### 5.1 Función `askSmartCoach`

**Propósito:** Cuando el usuario pide una alternativa o modificación a la recomendación en la pantalla completa, esta función usa Gemini 2.5 Flash para generar una nueva receta que encaje en los macros.

**Parámetros (`SmartCoachRefinementContext`):**

- `calorieGap`, `proteinGap`, `carbsGap`, `fatGap`: Déficits actuales.
- `currentFoodName`: Nombre de la comida recomendada actualmente.
- `currentMessage`: Mensaje de la recomendación actual.
- `userMessage`: Lo que el usuario escribió en el chat.
- `dietaryPreference`: Preferencia dietética del usuario.

**Modelo:** `gemini-2.5-flash` (endpoint `v1beta/models/gemini-2.5-flash:generateContent`).

**Prompt clave:**

- Instrucciones: "NUNCA digas que no encontraste algo. Si el usuario pide algo como 'pizza', inventa una versión saludable (ej: masa de coliflor o integral) que encaje en sus macros. Sé creativo y resolutivo."
- Siempre devolver `type: "food"` o `"meal"`, nunca `"fallback"`.
- Campos requeridos: `ingredients` e `instructions` (arrays de strings en ESPAÑOL).
- También incluir: `image_description` (ESPAÑOL, estética) e `image_search_term` (INGLÉS, para búsqueda).

**Respuesta (`SmartCoachRefinementResult`):**

- `type: "food"`: `name`, macros por 100g, `recommendedAmount`, `unitLabel`, `message`, `ingredients[]`, `instructions[]`, `image_description`, `image_search_term`.
- `type: "fallback"`: Solo `message` (fallback si falla el parseo o la API).

**Parseo robusto:**

- Limpieza de markdown (`json, `).
- Limpieza de caracteres de control y comillas tipográficas.
- Si `parsed.type === "fallback"` pero tiene `name` o `ingredients`, **fuerza** el tipo a `"food"`.
- Log de depuración: `console.log("Respuesta cruda de Gemini:", raw)` al inicio del parseo.

### 5.2 Integración en pantalla completa

En `app/smart-coach-pro.tsx`:

- Chat de texto (`TextInput`) para que el usuario escriba peticiones.
- `handleSendRefinement`: Construye `SmartCoachRefinementContext` desde la recomendación actual y llama `askSmartCoach`.
- Si `result.type === "food"`, actualiza la recomendación en el store con los nuevos datos (incluyendo `ingredients` e `instructions`).
- Si hay `ingredients` e `instructions`, muestra botón "Ver Receta" que navega a `/recipe-detail` con los parámetros.

---

## 6. Pantalla completa (`app/smart-coach-pro.tsx`)

### 6.1 Propósito

Pantalla dedicada a pantalla completa (sin tab bar) que muestra la recomendación del Smart Coach Pro con:

- Vista detallada de la recomendación (comida o ejercicio).
- **Chat de refinamiento:** Input de texto para pedir alternativas usando `askSmartCoach`.
- Botón "Ver Receta" si la recomendación tiene `ingredients` e `instructions`.
- Quick Add desde la pantalla completa.
- Botón de sincronizar Health (si premium y es ejercicio).

### 6.2 Estados y navegación

- **Store Zustand:** Lee `recommendation` y `successCaloriesBurned` desde `useSmartCoachRecommendationStore`.
- **Navegación:** Si no hay recomendación ni `successCaloriesBurned` y es premium, redirige a Home.
- **Cold start fallback:** Si es premium sin recomendación, busca en `generic_foods` por tags según momento del día y preferencia dietética, genera una recomendación de bienvenida.
- **Al agregar comida:** Limpia recomendación y vuelve a Home.

### 6.3 Chat de refinamiento

- Input de texto (`chatText`) con botón de envío.
- Estado `refining` durante la llamada a `askSmartCoach`.
- Si hay fallback (`result.type === "fallback"`), muestra `fallbackMessage`.
- Si hay éxito, actualiza la recomendación en el store con `setRecommendation`.

### 6.4 Navegación a receta

- Si `recommendedFood.ingredients` y `instructions` existen, muestra botón "Ver Receta".
- Navegación: `router.push({ pathname: "/recipe-detail", params: { name, protein_100g, carbs_100g, fat_100g, kcal_100g, recommendedAmount, message, ingredients: JSON.stringify(ingredients), instructions: JSON.stringify(instructions) } })`.

---

## 7. Pantalla de receta (`app/recipe-detail.tsx`)

### 7.1 Propósito

Muestra el detalle completo de una receta generada por IA o recomendada por el Smart Coach Pro.

### 7.2 Parámetros de navegación

- `name`: Nombre de la receta.
- `protein_100g`, `carbs_100g`, `fat_100g`, `kcal_100g`: Macros por 100g.
- `recommendedAmount`: Cantidad recomendada en gramos.
- `message`: Mensaje del coach (opcional).
- `ingredients`: JSON string array de ingredientes.
- `instructions`: JSON string array de instrucciones.

### 7.3 UI

- **Header:** Botón de retroceso + título "Receta".
- **Nombre del plato:** Título grande.
- **Mensaje del coach:** Si existe, en tarjeta con estilo.
- **Macros:** Chips con iconos (kcal, proteína, carbos, grasas) calculados para `recommendedAmount`.
- **Porción recomendada:** Texto con `recommendedAmount`g.
- **Ingredientes:** Checklist interactiva (marcar/desmarcar con haptic feedback).
- **Preparación:** Pasos numerados en tarjetas.

### 7.4 Funcionalidad

- Parseo de arrays JSON desde parámetros de URL.
- Estado local para ingredientes marcados (`checkedIngredients`).
- Cálculo de macros: `factor = recommendedAmount / 100`, luego `macro = macro_100g * factor`.

---

## 8. Componente `SmartCoachPro.tsx` (Home)

### 8.1 Props

- `recommendation`, `loading`, `isPremium`.
- `caloriesConsumed?`, `caloriesTarget?`: usados solo en estado no premium para el mensaje dinámico (déficit y momento del día).
- `onFoodAdded?`: llamado después de agregar la comida con Quick Add (para refrescar Home/summary).
- `onShowPaywall?`: abre el paywall (ej. `setPaywallVisible(true)`).
- `onViewFullPlan?`: navega a `/smart-coach-pro` (pantalla completa).
- `onViewSuccessPlan?`: navega a `/smart-coach-pro` en modo éxito (cuando `caloriesBurned > 0` y no hay recomendación).

### 8.2 Helper "Momento del día"

- `getMomentOfDayLabel()`: "Desayuno" (5–11h), "Almuerzo" (11–15h), "Merienda" (15–19h), "Cena" (resto). Usado en el copy de la tarjeta no premium.

### 8.3 Estados de UI

1. **No premium (conversión):** Tarjeta con gradiente, icono lock-outline, título "Smart Coach Pro". Mensaje dinámico según déficit y momento del día. Botón "Revelar recomendación inteligente" → onShowPaywall. Enlace "¿Cómo funciona?" → `/about-smart-coach-pro`.
2. **Loading:** Spinner + "Analizando tu progreso...".
3. **Sin recomendación:** Si es premium y `caloriesBurned > 0` (Health), muestra mensaje de éxito. Si no, devuelve `null`.
4. **Recomendación tipo ejercicio:** Tarjeta con icono del primer ejercicio, mensaje, línea opcional "Ya quemaste X kcal hoy", botón de sincronizar Health (si premium), lista de ejercicios con minutos, botón "Ver plan completo" → onViewFullPlan.
5. **Recomendación tipo macro o caloría:** Tarjeta con icono de comida, mensaje, badge "De tu historial" si `source === "history"`, info nutricional (cantidad + kcal), opcionalmente "Lo has comido X veces", botón **Agregar** (Quick Add), botón "Ver plan completo" → onViewFullPlan.

### 8.4 Quick Add (solo recomendación de comida)

- Calcula gramos y factores: `factor = recommendedAmount / 100`, calorías y macros = valores por 100g \* factor.
- Determina comida del día por hora: 5–11 breakfast, 11–15 lunch, 15–19 snack, resto dinner.
- `foodLogRepository.create(day, meal, name, grams, calories, protein_g, carbs_g, fat_g, source: null, off_id: null, ...)`.
- Toast de éxito o error, haptic, delay 300 ms y luego `onFoodAdded?.()` para refrescar.

### 8.5 Iconos de ejercicio

- Mapeo de nombres de icono a MaterialCommunityIcons válidos (ej. "droplet" → "water", "zap" → "lightning-bolt"). Por defecto "run".

---

## 9. Store Zustand (`smartCoachRecommendationStore.ts`)

### 9.1 Estado

```typescript
{
  recommendation: SmartCoachRecommendation | null;
  successCaloriesBurned: number | null; // Si > 0, mostrar pantalla en modo éxito
  setRecommendation: (r: SmartCoachRecommendation | null) => void;
  openSuccessScreen: (caloriesBurned: number) => void;
  clearRecommendation: () => void;
}
```

### 9.2 Uso

- **Home:** Al hacer tap en "Ver plan completo" o cuando hay recomendación, llama `setRecommendation(recommendation)` y navega a `/smart-coach-pro`.
- **Pantalla completa:** Lee `recommendation` y `successCaloriesBurned` del store.
- **Al agregar comida:** Llama `clearRecommendation()` y vuelve a Home.

---

## 10. Integración en Home (`app/(tabs)/home.tsx`)

### 10.1 Configuración

- **Target efectivo para el coach:** `effectiveTargetForCoach = caloriesTarget + caloriesBurned` si premium y `caloriesBurned > 0`; si no, `caloriesTarget`. Así el coach considera las calorías quemadas como "margen" antes de marcar superávit.
- `useSmartCoachPro(profile, effectiveTargetForCoach, totals.calories, totals.protein, totals.carbs, totals.fat, isPremium)`.
- **Premium:** `isPremium = revenueCatPremium || profilePremium` (RevenueCat prioritario).

### 10.2 Renderizado

- Se renderiza `<SmartCoachPro recommendation={...} loading={...} isPremium={...} onFoodAdded={handleFoodAdded} onShowPaywall={() => setPaywallVisible(true)} onViewFullPlan={handleViewFullPlan} onViewSuccessPlan={handleViewSuccessPlan} />`.
- `handleFoodAdded` debe refrescar resumen y comidas del día (p. ej. `reloadSummary`, `reloadMeals`) para que los totales y el propio coach se actualicen.
- `handleViewFullPlan`: `setSmartCoachRecommendation(smartCoach.recommendation!)` y `router.push("/smart-coach-pro")`.
- `handleViewSuccessPlan`: `openSuccessScreen(caloriesBurned)` y `router.push("/smart-coach-pro")`.

---

## 11. Dependencias de datos

- **Perfil:** `profile.weight_kg`, `profile.protein_g`, `profile.carbs_g`, `profile.fat_g` (metas de macros diarias), `profile.dietary_preference`.
- **Totales del día:** `useTodaySummary()` → `totals.calories`, `totals.protein`, `totals.carbs`, `totals.fat`.
- **Meta de calorías:** calculada en el flujo de la app (p. ej. desde mismo perfil o servicio de metas); en Home se pasa el target efectivo que incluye calorías quemadas si aplica.
- **Actividad del día:** `activityLogRepository.getTodayCalories(day)` (solo en escenario C y solo si premium).
- **Health:** en la UI, `useHealthSync(isPremium)` para mostrar calorías quemadas y botón de sincronizar; el coach usa ya las calorías guardadas en BD vía `getTodayCalories`.

---

## 12. Consideraciones para cambios futuros

### 12.1 Umbrales configurables

- 10 kcal para ignorar déficit pequeño.
- 5 g para considerar "gap de macro".
- 70% / 80% para cubrir déficit en A/B.
- 2–4.5 MET de noche.

### 12.2 Tags y filtros

- Los tags de `generic_foods` y la lista de "low value foods" están hardcodeados en `findPerfectFoodMatch`; cambiar ahí si se quieren más fuentes o exclusiones.
- Las keywords de preferencia dietética están en `useSmartCoachPro.ts` (MEAT_KEYWORDS, FISH_KEYWORDS, DAIRY_EGG_KEYWORDS).

### 12.3 Configuración de IA

- **Modelo:** `gemini-2.5-flash` (endpoint `v1beta/models/gemini-2.5-flash:generateContent`).
- **API Key:** `EXPO_PUBLIC_GEMINI_API_KEY` (misma que IA Scan).
- **Prompt:** Ver sección 5.1 para instrucciones del sistema. Si se cambia el comportamiento esperado, actualizar el prompt y esta documentación.

### 12.4 Número de ejercicios

- Actualmente se recomiendan hasta 2 ejercicios; el mensaje se basa en el primero.

### 12.5 Mensajes

- Generados en el hook según tipo de recomendación, hora y si hay actividad; para cambiar copy o lógica, editar `useSmartCoachPro` y actualizar esta doc.

---

## 13. Flujo completo de usuario

1. **Usuario en Home (premium):**
   - El hook `useSmartCoachPro` calcula gaps y genera recomendación.
   - Se muestra tarjeta `<SmartCoachPro>` con la recomendación.
   - Usuario puede hacer Quick Add o tocar "Ver plan completo".

2. **Navegación a pantalla completa:**
   - `setRecommendation(recommendation)` en store.
   - `router.push("/smart-coach-pro")`.
   - Pantalla muestra recomendación detallada.

3. **Chat de refinamiento:**
   - Usuario escribe en el input (ej. "quiero algo más proteico" o "dame una pizza saludable").
   - `handleSendRefinement` llama `askSmartCoach` con contexto.
   - Si éxito, se actualiza `recommendation` en store con nueva receta (incluye `ingredients` e `instructions`).
   - Si fallback, se muestra mensaje de error.

4. **Ver receta:**
   - Si hay `ingredients` e `instructions`, aparece botón "Ver Receta".
   - Navegación a `/recipe-detail` con parámetros.
   - Usuario ve checklist de ingredientes y pasos de preparación.

5. **Agregar comida:**
   - Desde Home o pantalla completa, Quick Add.
   - Se crea registro en `food_logs`.
   - Se limpia recomendación del store.
   - Se vuelve a Home y se refrescan totales.

---

**Última actualización:** Enero 2025.  
Al modificar cualquier parte de Smart Coach Pro, actualizar este archivo con el nuevo comportamiento o archivos afectados.
