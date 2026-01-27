# Smart Coach Pro – Documentación

> **Uso:** Cuando el usuario pida cambios o mencione "Smart Coach Pro", consultar este documento, aplicar los cambios en el código y **actualizar esta documentación** con los nuevos comportamientos o archivos tocados.

---

## 1. Resumen y propósito

**Smart Coach Pro** es una funcionalidad **solo premium** que, en la pantalla Home, analiza el progreso diario del usuario (calorías y macros consumidos vs. metas) y muestra **una única recomendación** por vez:

- **Escenario A (macro):** Faltan calorías y faltan macros → recomienda **comer un alimento** para priorizar el macro más deficitario.
- **Escenario B (caloría):** Faltan calorías pero los macros están al día → recomienda **comer un alimento** para completar calorías.
- **Escenario C (ejercicio):** Hay superávit calórico → recomienda **ejercicio(s)** para “quemar” el exceso (considerando actividad ya registrada en Apple Health / Health Connect si es premium).

La UI muestra la recomendación en una tarjeta con mensaje personalizado, y en escenarios A/B permite **Quick Add** (agregar la comida recomendada al día con un toque).

---

## 2. Archivos involucrados

| Archivo | Rol |
|--------|-----|
| `src/domain/models/smartCoach.ts` | Tipos: `SmartCoachRecommendation`, `MacroRecommendation`, `CalorieRecommendation`, `ExerciseRecommendation`, `SmartCoachState`. |
| `src/presentation/hooks/smartCoach/useSmartCoachPro.ts` | Toda la lógica: cálculo de gaps, selección de escenario, búsqueda de alimentos, cálculo de minutos de ejercicio, mensajes. |
| `src/presentation/components/smartCoach/SmartCoachPro.tsx` | UI: estados (no premium con mensaje dinámico y CTA persuasivo, loading, sin recomendación, ejercicio, comida), Quick Add, sincronización Health, paywall, enlace "¿Cómo funciona?" → AboutSmartCoachPro. |
| `app/(tabs)/home.tsx` | Integración: llama `useSmartCoachPro` con `profile`, targets, `totals`, `isPremium`; pasa `effectiveTargetForCoach`, `totals.calories`; renderiza `<SmartCoachPro>` con `caloriesConsumed`, `caloriesTarget`, `onFoodAdded`, `onShowPaywall`. |
| `app/about-smart-coach-pro.tsx` | Pantalla informativa "¿Cómo funciona el Smart Coach Pro?"; navegación desde el enlace en la tarjeta no premium. |

**Repositorios/servicios usados por el hook:**

- `foodLogRepository`: `getUniqueFoodsFromHistory(30)`, `create(...)` (Quick Add desde componente).
- `genericFoodsRepository`: `searchByTags(tags, 50)`.
- `userFoodsRepository`: `getAllForSmartSearch()`.
- `activityLogRepository`: `getTodayCalories(day)` (solo premium, escenario C).
- `exercisesRepository`: `listAll()` (escenario C).

---

## 3. Modelo de datos (`src/domain/models/smartCoach.ts`)

- **SmartCoachRecommendation** = `MacroRecommendation | CalorieRecommendation | ExerciseRecommendation`.
- **MacroRecommendation** (escenario A): `type: "macro"`, `priorityMacro`, `message`, `recommendedFood`, `macroGaps` (gap/consumed/target por proteína, carbos, grasa, calorías).
- **CalorieRecommendation** (escenario B): `type: "calorie"`, `message`, `recommendedFood`, `calorieGap`.
- **ExerciseRecommendation** (escenario C): `type: "exercise"`, `message`, `exercises[]` (cada uno: `exercise` + `minutesNeeded`), `excessCalories`, opcionalmente `activityCaloriesBurned` y `remainingExcess`.
- **SmartCoachState**: `recommendation`, `loading`, `error`, `reload`.

`recommendedFood` incluye: `name`, `source` ("history" | "generic" | "user_food"), macros por 100g, `kcal_100g`, `recommendedAmount` (gramos o unidades), `unitLabel`, y si aplica `lastEaten`, `timesEaten`.

---

## 4. Lógica del hook (`useSmartCoachPro`)

### 4.1 Parámetros

- `profile` (ProfileDb | null): peso (`weight_kg`) y metas de macros (`protein_g`, `carbs_g`, `fat_g`).
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
2. **Déficit** y **gaps de macros** (protein/carbs/fat gap > 5)** → Escenario A (macro).
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
- **Búsqueda de alimento:** `findPerfectFoodMatch(gaps, priorityMacro, caloriesGap)`.
- **Cantidad recomendada:** `calculateRecommendedAmount(food, priorityMacro, priorityGap * 0.7, caloriesGap)` → se intenta cubrir ~70% del déficit del macro prioritario, respetando un tope de calorías (hasta ~110% de `caloriesGap`).
- Mensaje según origen del alimento (historial con “lo comiste hace X días”, receta propia, o genérico).
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
- Se excluyen alimentos de **bajo aporte**: p. ej. kcal_100g < 30 (o < 50 para calorías), o densidad baja del macro prioritario; y una lista fija de nombres (zanahoria, lechuga, apio, etc.).
- **Ordenación:** primero historial, luego por densidad del macro prioritario (mayor primero).
- Se devuelve el **primer** candidato (mejor match).

### 4.8 Cálculos auxiliares

- **Minutos para quemar calorías (MET):**  
  `minutes = (excessCalories * 200) / (MET * 3.5 * weight_kg)`, mín 1, redondeado a 1 decimal.
- **Cantidad recomendada (gramos):**  
  `gramsNeeded = (targetValue * 100) / macroValue` (macroValue = valor del macro o kcal por 100g). Si se pasa `maxCalories`, se limita para no exceder ~110% de ese límite.

### 4.9 Cuándo se ejecuta el hook

- **useEffect** cuando cambian `fetchRecommendation` y los consumos (calories, protein, carbs, fat); solo si hay “datos reales” (al menos un consumo > 0).
- **useFocusEffect** al recibir foco la pantalla (ej. volver al Home): resetea `isProcessingRef` y `lastExecutionDataRef`, luego llama `fetchRecommendation` si hay datos reales.
- Evita dobles ejecuciones con los mismos datos usando `lastExecutionDataRef` (comparando `caloriesConsumed` y `caloriesTarget`).

---

## 5. Componente `SmartCoachPro.tsx`

### 5.1 Props

- `recommendation`, `loading`, `isPremium`.
- `caloriesConsumed?`, `caloriesTarget?`: usados solo en estado no premium para el mensaje dinámico (déficit y momento del día).
- `onUpgrade?`: deprecated en favor de paywall.
- `onFoodAdded?`: llamado después de agregar la comida con Quick Add (para refrescar Home/summary).
- `onShowPaywall?`: abre el paywall (ej. `setPaywallVisible(true)`).

### 5.2 Helper "Momento del día"

- `getMomentOfDayLabel()`: "Desayuno" (5–11h), "Almuerzo" (11–15h), "Merienda" (15–19h), "Cena" (resto). Usado en el copy de la tarjeta no premium.

### 5.3 Estados de UI

1. **No premium (conversión):** Tarjeta con gradiente (LinearGradient), icono lock-outline, título "Smart Coach Pro". Mensaje dinámico: si déficit, "te faltan [X] kcal" + momento del día; si no, "recomendación personalizada para tu [momento]. Desbloquea Pro para verla." Botón "Revelar recomendación inteligente" (gradiente) → onShowPaywall. Enlace "¿Cómo funciona el Smart Coach Pro?" → router.push("/about-smart-coach-pro").
2. **Loading:** Spinner + “Analizando tu progreso...”.
3. **Sin recomendación:** Si es premium y `caloriesBurned > 0` (Health), muestra mensaje de éxito (actividad compensó el balance). Si no, devuelve `null` (no se muestra nada).
4. **Recomendación tipo ejercicio:** Tarjeta con icono del primer ejercicio, mensaje, opcionalmente línea “Ya quemaste X kcal hoy con actividad física”, botón de sincronizar Apple Health/Health Connect (si premium), y lista de ejercicios con minutos.
5. **Recomendación tipo macro o caloría:** Tarjeta con icono de comida, mensaje, badge “De tu historial” si `source === "history"`, info nutricional (cantidad + kcal), opcionalmente “Lo has comido X veces en los últimos 30 días”, y botón **Agregar** (Quick Add).

### 5.4 Quick Add (solo recomendación de comida)

- Calcula gramos y factores: `factor = recommendedAmount / 100`, calorías y macros = valores por 100g * factor.
- Determina comida del día por hora: 5–11 breakfast, 11–15 lunch, 15–19 snack, resto dinner.
- `foodLogRepository.create(day, meal, name, grams, calories, protein_g, carbs_g, fat_g, source: null, off_id: null, ...)`.
- Toast de éxito o error, haptic, delay 300 ms y luego `onFoodAdded?.()` para refrescar.

### 5.5 Iconos de ejercicio

- Mapeo de nombres de icono a MaterialCommunityIcons válidos (ej. "droplet" → "water", "zap" → "lightning-bolt"). Por defecto "run".

---

## 6. Integración en Home (`app/(tabs)/home.tsx`)

- **Target efectivo para el coach:** `effectiveTargetForCoach = caloriesTarget + caloriesBurned` si premium y `caloriesBurned > 0`; si no, `caloriesTarget`. Así el coach considera las calorías quemadas como “margen” antes de marcar superávit.
- `useSmartCoachPro(profile, effectiveTargetForCoach, totals.calories, totals.protein, totals.carbs, totals.fat, isPremium)`.
- **Premium:** `isPremium = revenueCatPremium || profilePremium` (RevenueCat prioritario).
- Se renderiza `<SmartCoachPro recommendation={...} loading={...} isPremium={...} onFoodAdded={handleFoodAdded} onShowPaywall={() => setPaywallVisible(true)} />`.
- `handleFoodAdded` debe refrescar resumen y comidas del día (p. ej. `reloadSummary`, `reloadMeals`) para que los totales y el propio coach se actualicen.

---

## 7. Dependencias de datos

- **Perfil:** `profile.weight_kg`, `profile.protein_g`, `profile.carbs_g`, `profile.fat_g` (metas de macros diarias).
- **Totales del día:** `useTodaySummary()` → `totals.calories`, `totals.protein`, `totals.carbs`, `totals.fat`.
- **Meta de calorías:** calculada en el flujo de la app (p. ej. desde mismo perfil o servicio de metas); en Home se pasa el target efectivo que incluye calorías quemadas si aplica.
- **Actividad del día:** `activityLogRepository.getTodayCalories(day)` (solo en escenario C y solo si premium).
- **Health:** en la UI, `useHealthSync(isPremium)` para mostrar calorías quemadas y botón de sincronizar; el coach usa ya las calorías guardadas en BD vía `getTodayCalories`.

---

## 8. Consideraciones para cambios futuros

- **Umbrales:** 10 kcal para ignorar déficit pequeño; 5 g para considerar “gap de macro”; 70% / 80% para cubrir déficit en A/B; 2–4.5 MET de noche.
- **Tags y filtros:** Los tags de `generic_foods` y la lista de “low value foods” están hardcodeados en `findPerfectFoodMatch`; cambiar ahí si se quieren más fuentes o exclusiones.
- **Número de ejercicios:** Actualmente se recomiendan hasta 2 ejercicios; el mensaje se basa en el primero.
- **Mensajes:** Generados en el hook según tipo de recomendación, hora y si hay actividad; para cambiar copy o lógica, editar `useSmartCoachPro` y actualizar esta doc.

---

**Última actualización:** Enero 2025.  
Al modificar cualquier parte de Smart Coach Pro, actualizar este archivo con el nuevo comportamiento o archivos afectados.
