# Escaneo de código de barras y Open Food Facts – Documentación

> **Uso:** Para preguntas o cambios en "escaneo de código de barras", "barcode", "Open Food Facts" o "OFF", **consultar SIEMPRE este documento primero** y luego aplicar la lógica. No asumir flujos ni nombres de API sin leer esta documentación.

---

## 1. Resumen

Jerarquía de búsqueda por **código de barras** en add-food:

1. **Prioridad API externa (Open Food Facts):** Se consulta `GET https://world.openfoodfacts.org/api/v2/product/{code}`. Si el producto existe, se usa en la app pero **no se guarda en la base de datos** (evitar saturación).
2. **Prioridad local (Supabase):** Si no existe en OFF, se busca en la tabla `generic_foods` por la columna `barcode` (`genericFoodsRepository.getByBarcode(barcode)`).
3. **Creación:** Si no existe en ninguna de las anteriores, se muestra un formulario para insertar el producto en `generic_foods` (nombre, barcode bloqueado, kcal_100g, protein_100g, carbs_100g, fat_100g). Componente: `CreateGenericFoodByBarcodeModal`.

- **Búsqueda por texto en OFF:** `GET https://world.openfoodfacts.org/cgi/search.pl` (API v1), usada cuando el usuario escribe y elige "Buscar en Open Food Facts".

**Mapeo OFF → columnas propias:** En `openFoodFactsService.mapOffProduct`: `nutriments.proteins_100g` → `protein_100g`, `nutriments.carbohydrates_100g` → `carbs_100g`, `nutriments.fat_100g` → `fat_100g`, energía (kJ/kcal) → `kcal_100g`. Coincide con `generic_foods` (protein_100g, carbs_100g, fat_100g, kcal_100g).

---

## 2. Dónde leer documentación (orden recomendado)

| Tema                                  | Archivo / recurso                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Servicio OFF (API, barcode, búsqueda) | `src/data/openfoodfacts/openFoodFactsService.ts`                                                          |
| Modelo de producto OFF                | `src/domain/models/offProduct.ts`                                                                         |
| Pantalla de escaneo (barcode vs IA)   | `app/(tabs)/scan.tsx`                                                                                     |
| Flujo barcode → add-food              | `app/(tabs)/add-food.tsx` (params.barcode, useEffect barcode, ExtendedFoodSearchItem, guardar con off_id) |
| Flujo barcode → my-foods              | `app/(tabs)/my-foods.tsx` (params.barcode, useEffect barcode cuando showCreateModal)                      |
| Cómo se guarda en BD (source, off_id) | `src/data/food/foodLogRepository.ts` + uso en add-food (foodLogRepository.create con source/off_id)       |
| Esquema BD (food_logs)                | `.cursor/rules/database-schema.md` y MEMORY.md                                                            |
| Escaneo por IA (Gemini, no barcode)   | `.cursor/rules/ia-scan-and-gemini.md`                                                                     |

**Regla:** Antes de responder o implementar algo sobre barcode u OFF, **leer esta documentación y los archivos indicados**; luego aplicar la lógica.

---

## 3. API de Open Food Facts

- **Base URL:** `https://world.openfoodfacts.org`
- **Sin API key:** La API es pública; no se usa autenticación.

### 3.1 Producto por código de barras (v2)

- **Método y URL:** `GET /api/v2/product/{code}`
- **Parámetros de query:** `fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments,serving_quantity_unit,quantity`
- **Implementación:** `openFoodFactsService.getByBarcode(barcode, signal?)` en `src/data/openfoodfacts/openFoodFactsService.ts`.
- **Respuesta:** JSON con `status` (1 = encontrado, 0 = no encontrado) y `product` (objeto con nutriments, code, nombres, etc.). Si `status === 0` se devuelve error "Producto no encontrado" (o `status_verbose`).

### 3.2 Búsqueda por texto (v1)

- **URL:** `/cgi/search.pl`
- **Parámetros:** `search_terms`, `search_simple=1`, `action=process`, `json=1`, `page`, `page_size`, `lc` (idioma), `cc` (país), `fields=...`
- **Implementación:** `openFoodFactsService.search({ query, page, pageSize, cc, lc, signal })` en el mismo servicio.
- **Uso en app:** add-food llama a `search()` cuando el usuario busca por texto y se elige búsqueda en Open Food Facts (no desde el escáner físico).

### 3.3 Mapeo respuesta API (OFF) → modelo interno y generic_foods

- **Función:** `mapOffProduct(raw)` dentro de `openFoodFactsService.ts` (no exportada).
- **Modelo:** `OffProduct` en `src/domain/models/offProduct.ts`: `id`, `barcode?`, `name`, `brand?`, `imageUrl?`, `kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g`, `basis: "100g"`, `unitType: "gr" | "ml"` (líquido vs sólido; se infiere de `serving_quantity_unit` o `quantity` en OFF).
- **Nombre:** Se usa `pickName(raw)`: `product_name` → `product_name_es` → `product_name_en` → `generic_name` → "Producto sin nombre".
- **Energía:** Open Food Facts puede devolver energía en kJ o kcal; `convertEnergyToKcal` normaliza a kcal (1 kcal = 4.184 kJ). Campos OFF: `energy-kcal_100g`, `energy-kj_100g` o `energy_100g` → `kcal_100g`.
- **Macros:** OFF `nutriments.proteins_100g` → `protein_100g`; `nutriments.carbohydrates_100g` → `carbs_100g`; `nutriments.fat_100g` → `fat_100g`. Misma nomenclatura que `generic_foods` (protein_100g, carbs_100g, fat_100g, kcal_100g).

---

## 4. Archivos involucrados (referencia rápida)

| Archivo                                                                     | Rol                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/data/openfoodfacts/openFoodFactsService.ts`                            | **Único punto de llamada a la API de Open Food Facts.** `search()`, `getByBarcode(barcode, signal?)`, `mapOffProduct`, `pickName`, `convertEnergyToKcal`. Base URL: `https://world.openfoodfacts.org`.                                                                                                                 |
| `src/domain/models/offProduct.ts`                                           | Tipo `OffProduct`: id, barcode, name, brand, imageUrl, nutrientes por 100g, basis.                                                                                                                                                                                                                                     |
| `app/(tabs)/scan.tsx`                                                       | Pantalla escáner: modo `barcode` vs `ai`. En modo barcode usa `CameraView` con `onBarcodeScanned` y `barcodeScannerSettings` (ean13, upc_a, upc_e, ean8, code128). Al escanear: `router.replace` a add-food o my-foods con `params.barcode` (y `meal` / `returnTo`).                                                   |
| `app/(tabs)/add-food.tsx`                                                   | Recibe `params.barcode`. Flujo jerárquico: 1) OFF `getByBarcode` (usar sin guardar en BD); 2) `genericFoodsRepository.getByBarcode(barcode)`; 3) si no está en ninguno, abre `CreateGenericFoodByBarcodeModal` para insertar en `generic_foods`. Refs `isBarcodeSearchRef`, `justProcessedBarcodeRef`.                 |
| `src/data/food/genericFoodsRepository.ts`                                   | `getByBarcode(barcode)` busca en `generic_foods` por columna `barcode`. `createByBarcode({ name_es, barcode, kcal_100g, protein_100g, carbs_100g, fat_100g })` inserta producto nuevo (base 100g).                                                                                                                     |
| `src/presentation/components/nutrition/CreateGenericFoodByBarcodeModal.tsx` | Modal para crear producto en `generic_foods`: nombre, barcode (bloqueado), kcal/protein/carbs/fat por 100g. Enlace "O contribuir en Open Food Facts".                                                                                                                                                                  |
| `app/(tabs)/my-foods.tsx`                                                   | Recibe `params.barcode`. `useEffect` con deps `[params.barcode, showCreateModal]`: si hay barcode y modal abierto, llama `openFoodFactsService.getByBarcode(barcode, signal)`, construye `ExtendedFoodSearchItem` (source "off"), `setSelectedIngredient(it)`, `setSearchQuery(res.data.name)`, `setShowSearch(true)`. |
| `src/domain/mappers/foodMappers.ts`                                         | `FoodSearchItem` con `source: "user_food"                                                                                                                                                                                                                                                                              | "food" | "off"`. No hay mapper OFF→FoodSearchItem en este archivo; add-food y my-foods construyen a mano el item extendido con `off`. |
| `src/data/food/foodLogRepository.ts`                                        | `create()` acepta `source`, `off_id`, `source_type`, `food_id`, `user_food_id`. Para productos OFF se usa `source: "openfoodfacts"`, `off_id` con el id/code del producto OFF.                                                                                                                                         |
| `src/core/featureFlags/flags.ts`                                            | Feature flag `barcodeScanUnlimited` (relacionado con límites de escaneo; por defecto false, true si premium).                                                                                                                                                                                                          |

---

## 5. Flujo completo: Barcode → Add Food (jerarquía OFF → local → creación)

1. Usuario en **scan** (modo barcode) escanea código → `onBarcodeScanned({ data })`.
2. `scan.tsx` hace `router.replace("/(tabs)/add-food", { params: { meal, barcode: data } })` (o my-foods si `returnTo === "my-foods"`).
3. **add-food** monta con `params.barcode`. Un `useEffect` dependiente de `params.barcode`:
   - **Paso 1 – API externa:** Llama `openFoodFactsService.getByBarcode(barcode, signal)`. Si `res.ok` y `res.data`, usa el producto de OFF (no lo guarda en BD), construye `ExtendedFoodSearchItem` con `source: "off"`, `setSelected(it)`, limpia params y termina.
   - **Paso 2 – Local:** Si no hubo resultado en OFF, llama `genericFoodsRepository.getByBarcode(barcode)`. Si hay dato, mapea con `mapGenericFoodDbToSearchItem`, `setSelected(it)`, limpia params y termina.
   - **Paso 3 – Creación:** Si no está en OFF ni en `generic_foods`, abre `CreateGenericFoodByBarcodeModal` con el barcode (bloqueado). El usuario completa nombre y macros por 100g; al guardar se llama `genericFoodsRepository.createByBarcode(...)` y se inserta en `generic_foods`. Tras éxito, se usa el nuevo alimento como seleccionado.
4. Usuario ajusta cantidad y confirma. Al guardar en food_logs: `source: "openfoodfacts"` si vino de OFF, `source: "generic_foods"` y `food_id` si vino de generic_foods (local o recién creado).
5. No se guarda en "recientes" cuando `source === "off"` (solo generic_foods y user_foods).

---

## 6. Flujo: Barcode → My Foods (ingrediente en receta)

1. Usuario en **scan** con `returnTo === "my-foods"` escanea → `router.replace("/(tabs)/my-foods", { params: { barcode: data } })`.
2. **my-foods** tiene `useEffect` con `[params.barcode, showCreateModal]`: si hay barcode y el modal de crear receta está abierto, llama `openFoodFactsService.getByBarcode(barcode, signal)`, construye el mismo tipo de `ExtendedFoodSearchItem` (source "off"), asigna a `selectedIngredient`, actualiza búsqueda y muestra el panel de búsqueda.

---

## 7. Tipos de código de barras soportados (expo-camera)

En `app/(tabs)/scan.tsx`, `barcodeScannerSettings.barcodeTypes`: `["ean13", "upc_a", "upc_e", "ean8", "code128"]`. Son los más comunes en productos de alimentación.

---

## 8. Cancelación y estado

- **add-food:** Se usa `AbortController` en el useEffect del barcode; el cleanup hace `abort()`. Refs `isBarcodeSearchRef` y `justProcessedBarcodeRef` evitan que `useFocusEffect` limpie `selected` o cancele la petición mientras la búsqueda por barcode está en curso o recién completada.
- **my-foods:** También se usa `AbortController` en el useEffect del barcode; cleanup con `abort()`.

---

## 9. Errores y mensajes

- Barcode vacío: `openFoodFactsService.getByBarcode` devuelve `{ ok: false, message: "Barcode vacío." }`.
- **Producto no encontrado:** La API v2 de OFF devuelve **HTTP 404** cuando el código no está en su base de datos. El servicio devuelve un mensaje amigable: "Producto no encontrado en Open Food Facts. Puedes buscarlo por nombre o agregarlo manualmente." (no mostrar "OFF product error (404)" al usuario).
- Producto no encontrado (respuesta 200 con status 0): si OFF respondiera 200 con `status === 0`, se usa `status_verbose` o "Producto no encontrado.".
- Request cancelada: si `signal.aborted` o `AbortError`, se devuelve `{ ok: false, message: "Búsqueda cancelada." }`.
- Errores de red u otros: capturados en el servicio y devueltos como `{ ok: false, message: ... }`. add-food/my-foods muestran `setErr(res.message)` o equivalente.

---

## 10. Regla para el agente

- **Siempre** que te pregunten por escanear código de barras, Open Food Facts, barcode o flujo desde el escáner: **leer primero este archivo** (`.cursor/rules/barcode-scan-and-openfoodfacts.md`) y, si hace falta, los archivos listados en la sección 2.
- **No** asumir endpoints, nombres de campos ni flujos sin verificar en esta documentación o en el código referenciado.
- Al cambiar algo en el servicio OFF, en scan.tsx (barcode), en add-food o my-foods relacionado con barcode/OFF, **actualizar este documento** para mantener la referencia correcta.

---

**Última actualización:** Enero 2025.  
Al modificar escaneo de código de barras o integración con Open Food Facts, actualizar este archivo.
