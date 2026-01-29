# Escaneo de código de barras y Open Food Facts – Documentación

> **Uso:** Para preguntas o cambios en "escaneo de código de barras", "barcode", "Open Food Facts" o "OFF", **consultar SIEMPRE este documento primero** y luego aplicar la lógica. No asumir flujos ni nombres de API sin leer esta documentación.

---

## 1. Resumen

El **código de barras** escaneado en la app se envía a la **API de Open Food Facts** (world.openfoodfacts.org). No hay otra fuente para barcode: **todo barcode va a OFF**.

- **Búsqueda por barcode:** `GET https://world.openfoodfacts.org/api/v2/product/{code}` (API v2).
- **Búsqueda por texto:** `GET https://world.openfoodfacts.org/cgi/search.pl` (API v1), usada en add-food cuando el usuario escribe en la barra de búsqueda y elige "Buscar en Open Food Facts".

Hay dos flujos principales de **barcode**:

1. **Add Food:** Escanear → navegar a add-food con `params.barcode` → buscar en OFF → mostrar producto como seleccionado → usuario confirma cantidad y guarda en `food_logs` con `source: "openfoodfacts"`, `off_id`.
2. **My Foods:** Escanear desde "Mis comidas" → navegar a my-foods con `params.barcode` → si el modal de crear receta está abierto, buscar en OFF y pre-rellenar ingrediente (Open Food Facts como sugerencia para la receta).

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
- **Parámetros de query:** `fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments`
- **Implementación:** `openFoodFactsService.getByBarcode(barcode, signal?)` en `src/data/openfoodfacts/openFoodFactsService.ts`.
- **Respuesta:** JSON con `status` (1 = encontrado, 0 = no encontrado) y `product` (objeto con nutriments, code, nombres, etc.). Si `status === 0` se devuelve error "Producto no encontrado" (o `status_verbose`).

### 3.2 Búsqueda por texto (v1)

- **URL:** `/cgi/search.pl`
- **Parámetros:** `search_terms`, `search_simple=1`, `action=process`, `json=1`, `page`, `page_size`, `lc` (idioma), `cc` (país), `fields=...`
- **Implementación:** `openFoodFactsService.search({ query, page, pageSize, cc, lc, signal })` en el mismo servicio.
- **Uso en app:** add-food llama a `search()` cuando el usuario busca por texto y se elige búsqueda en Open Food Facts (no desde el escáner físico).

### 3.3 Mapeo respuesta API → modelo interno

- **Función:** `mapOffProduct(raw)` dentro de `openFoodFactsService.ts` (no exportada).
- **Modelo:** `OffProduct` en `src/domain/models/offProduct.ts`: `id`, `barcode?`, `name`, `brand?`, `imageUrl?`, `kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g`, `basis: "100g"`.
- **Nombre:** Se usa `pickName(raw)`: `product_name` → `product_name_es` → `product_name_en` → `generic_name` → "Producto sin nombre".
- **Energía:** Open Food Facts puede devolver energía en kJ o kcal; `convertEnergyToKcal` normaliza a kcal (1 kcal = 4.184 kJ). Campos: `energy-kcal_100g`, `energy-kj_100g` o `energy_100g`.

---

## 4. Archivos involucrados (referencia rápida)

| Archivo                                          | Rol                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/data/openfoodfacts/openFoodFactsService.ts` | **Único punto de llamada a la API de Open Food Facts.** `search()`, `getByBarcode(barcode, signal?)`, `mapOffProduct`, `pickName`, `convertEnergyToKcal`. Base URL: `https://world.openfoodfacts.org`.                                                                                                                                                                                                                                                                                      |
| `src/domain/models/offProduct.ts`                | Tipo `OffProduct`: id, barcode, name, brand, imageUrl, nutrientes por 100g, basis.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `app/(tabs)/scan.tsx`                            | Pantalla escáner: modo `barcode` vs `ai`. En modo barcode usa `CameraView` con `onBarcodeScanned` y `barcodeScannerSettings` (ean13, upc_a, upc_e, ean8, code128). Al escanear: `router.replace` a add-food o my-foods con `params.barcode` (y `meal` / `returnTo`).                                                                                                                                                                                                                        |
| `app/(tabs)/add-food.tsx`                        | Recibe `params.barcode`. `useEffect` dependiente de `params.barcode` llama `openFoodFactsService.getByBarcode(barcode, abortController.signal)`, construye `ExtendedFoodSearchItem` con `source: "off"`, `off: res.data`, y hace `setSelected(it)`. Al guardar: `foodLogRepository.create` con `source: "openfoodfacts"`, `off_id: selected.off?.id ?? null`. Refs `isBarcodeSearchRef`, `justProcessedBarcodeRef` para evitar que useFocusEffect limpie o cancele la búsqueda por barcode. |
| `app/(tabs)/my-foods.tsx`                        | Recibe `params.barcode`. `useEffect` con deps `[params.barcode, showCreateModal]`: si hay barcode y modal abierto, llama `openFoodFactsService.getByBarcode(barcode, signal)`, construye `ExtendedFoodSearchItem` (source "off"), `setSelectedIngredient(it)`, `setSearchQuery(res.data.name)`, `setShowSearch(true)`.                                                                                                                                                                      |
| `src/domain/mappers/foodMappers.ts`              | `FoodSearchItem` con `source: "user_food"                                                                                                                                                                                                                                                                                                                                                                                                                                                   | "food" | "off"`. No hay mapper OFF→FoodSearchItem en este archivo; add-food y my-foods construyen a mano el item extendido con `off`. |
| `src/data/food/foodLogRepository.ts`             | `create()` acepta `source`, `off_id`, `source_type`, `food_id`, `user_food_id`. Para productos OFF se usa `source: "openfoodfacts"`, `off_id` con el id/code del producto OFF.                                                                                                                                                                                                                                                                                                              |
| `src/core/featureFlags/flags.ts`                 | Feature flag `barcodeScanUnlimited` (relacionado con límites de escaneo; por defecto false, true si premium).                                                                                                                                                                                                                                                                                                                                                                               |

---

## 5. Flujo completo: Barcode → Add Food → food_logs

1. Usuario en **scan** (modo barcode) escanea código → `onBarcodeScanned({ data })` con el código.
2. `scan.tsx` hace `router.replace("/(tabs)/add-food", { params: { meal, barcode: data } })` (o my-foods con `barcode` si `returnTo === "my-foods"`).
3. **add-food** monta con `params.barcode`. Un `useEffect` que depende de `params.barcode`:
   - Crea `AbortController`, llama `openFoodFactsService.getByBarcode(barcode, signal)`.
   - Si `res.ok` y `res.data`, construye `ExtendedFoodSearchItem`: `key: "off:" + res.data.id`, `source: "off"`, `name`, `meta` (brand), nutrientes desde `res.data`, `off: res.data`.
   - `setSelected(it)`, `setQuery(res.data.name)`, `setResults([])`, luego `router.setParams({ barcode: undefined })` para evitar re-búsqueda al volver.
4. Usuario ajusta cantidad (gramos o unidades si aplica) y confirma. Al guardar:
   - `foodLogRepository.create({ day, meal, name, grams, calories, protein_g, carbs_g, fat_g, source: "openfoodfacts", off_id: selected.off?.id ?? null, source_type: "manual", ... })`.
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
