# Spotlight Tour - Guía de Implementación

## Objetivo
Crear un **tour guiado bloqueante** con spotlight interactivo que muestre al usuario cómo usar ContaMacros en 6 pasos, desde el home hasta agregar su primera comida.

---

## Requisitos

### 1. Sistema de Spotlight/Overlay
- **Overlay oscuro**: 85% opacidad negro que cubre toda la pantalla
- **Agujero transparente**: rect/círculo alrededor del elemento target
- **Animación de pulse**: el borde del agujero pulsa cada 1.5s para atraer atención
- **Bloqueante**: cualquier toque FUERA del target es ignorado (pero anima el pulse más fuerte como feedback)
- **Botón "Saltar"**: siempre visible arriba a la derecha en cada paso

### 2. Contexto Global del Tour
Crear `TourContext` en `src/presentation/hooks/tour/TourContext.tsx`:
- Estado: qué paso del tour está activo (0-5)
- Métodos: `nextStep()`, `skipTour()`, `completeTour()`, `startTour()`
- Tracking: si el tour ya fue completado (via `FEATURE_TOUR_SEEN`)

### 3. Componente SpotlightOverlay
Crear `src/presentation/components/tour/SpotlightOverlay.tsx`:
- Props: `targetRef`, `targetShape` ("rect" | "circle"), `tooltipText`, `position` ("bottom" | "top")
- Renderiza el overlay oscuro + agujero transparente
- Anima el pulse del borde
- Muestra tooltip con texto + botones "Siguiente" / "Saltar"
- Bloquea touches fuera del target

### 4. 6 Pasos del Tour

**Paso 0 - Home (Bienvenida)**
```
Elemento: Tarjeta de calorías/macros
Texto: "Aquí ves tu progreso diario de calorías y macronutrientes.
Vamos a agregar tu primera comida para empezar a rastrear."
Botón: "Siguiente"
```

**Paso 1 - Home (Ir a Diary)**
```
Elemento: Tab "Diary"
Texto: "Toca aquí para ver tu historial de comidas del día."
Usuario debe tocar el tab → navega a Diary
```

**Paso 2 - Diary (Agregar Comida)**
```
Elemento: Botón "Agregar comida"
Texto: "Toca aquí para registrar una nueva comida."
Usuario toca → abre screen add-food
```

**Paso 3 - Add-Food (Escaneo)**
```
Elemento: Botón de escaneo (IA o código de barras)
Texto: "Puedes escanear el código de barras de un producto
o tomar una foto de tu comida con IA.
Elige el que prefieras."
Botón: "Siguiente"
```

**Paso 4 - Add-Food (Tipo de Comida)**
```
Elemento: Selector de tipo (Desayuno/Almuerzo/Cena/Snack)
Texto: "Selecciona qué tipo de comida es.
Esto ayuda a organizar tu historial."
Usuario selecciona → botón "Siguiente"
```

**Paso 5 - Finish**
```
Modal de conclusión:
Texto: "¡Excelente! Ya sabes cómo usar ContaMacros.
Ahora agrega tus comidas y alcanza tus objetivos."
Botón: "¡Empezar a usar!"
Guarda FEATURE_TOUR_SEEN = "true"
Cierra el tour
```

### 5. Integración en Pantallas

**En `app/(tabs)/home.tsx`:**
- Reemplazar el `TourModal` actual con `SpotlightTour`
- Referencia al elemento "Tarjeta de calorías" via `useRef`
- Cuando paso 1, usuario toca tab Diary → navega + advance tour

**En `app/(tabs)/diary.tsx`:**
- Si tour está activo (paso 2), mostrar spotlight en botón "Agregar comida"
- Cuando usuario toca → continúa el tour

**En `app/(tabs)/add-food.tsx`:**
- Paso 3: spotlight en opciones de escaneo
- Paso 4: spotlight en selector de tipo de comida

---

## Arquitectura de Archivos

```
src/presentation/
├── hooks/tour/
│   ├── TourContext.tsx          (contexto + provider)
│   └── useTour.ts               (hook para acceder al context)
├── components/tour/
│   ├── SpotlightOverlay.tsx     (componente principal)
│   ├── TourTooltip.tsx          (tooltip dentro del overlay)
│   └── TourProvider.tsx         (wrapper que rodea toda la app)
```

---

## Flujo de Ejecución

1. Usuario completa onboarding → llega a home
2. `home.tsx` checkea si tour debe correr (FEATURE_TOUR_SEEN !== "true")
3. `TourProvider` rodea toda la app en `_layout.tsx`
4. Tour paso 0: spotlight en tarjeta de calorías + tooltip
5. Usuario toca "Siguiente" → paso 1
6. Paso 1: spotlight en tab Diary (usuario toca → navega + avanza tour)
7. Paso 2: spotlight en botón "Agregar comida" en Diary
8. Usuario toca → abre add-food screen + paso 3
9. Paso 3: spotlight en escaneo
10. Paso 4: spotlight en selector de tipo
11. Paso 5: modal de conclusión + guarda FEATURE_TOUR_SEEN + cierra tour

---

## Consideraciones Técnicas

- **Refs**: Cada elemento target usa `useRef` para posicionamiento
- **Posicionamiento**: usa `measure()` para obtener coordenadas del target
- **Toast/Haptics**: toques bloqueados generan haptic feedback
- **Storage**: async, no bloquea el render
- **Android/iOS**: mismo comportamiento en ambas plataformas
- **TypeScript**: tipos fuertes para cada paso y props

---

## Siguiente Paso

Implementar:
1. `TourContext.tsx` + `useTour.ts`
2. `SpotlightOverlay.tsx` + `TourTooltip.tsx`
3. `TourProvider.tsx`
4. Integración en `_layout.tsx`, `home.tsx`, `diary.tsx`, `add-food.tsx`
