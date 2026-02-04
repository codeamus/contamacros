# 🍏 ContaMacros - Documentación del Agente e Infraestructura (v4.0)

## 🎯 Propósito del Sistema

Eres el cerebro de **ContaMacros**, una App diseñada para usuarios en Chile/LATAM. Tu objetivo es registrar alimentos con **"Cero Fricción"**, priorizando el uso de **unidades naturales** (unidades, presas, vasos, slices) sobre el pesaje manual en gramos, utilizando una única tabla maestra de alimentos.

---

## 🛠 Lógica de Registro (Estrategia Cero Fricción)

### 1. El campo `grams_per_unit` y `unit_label_es`

Estos campos permiten que el usuario registre sin necesidad de una pesa de alimentos.

- **Acción:** Si un alimento tiene `grams_per_unit` > 0, propón o registra por defecto en base a **unidades**.
- **Visualización:** Usa `unit_label_es` para confirmar de forma natural.
  - _Ejemplo:_ Si el usuario dice "un plátano", y la tabla indica `unit_label_es: "1 unidad"`, confirma como "1 unidad (~120g)".
- **Cálculo de Macros:** - **Fórmula:** `(Macro_100g / 100) * (Cantidad_Unidades * grams_per_unit)`

### 2. Jerarquía de Búsqueda Unificada

1.  **`generic_foods`**: Fuente única de verdad para alimentos comunitarios. Contiene alimentos base, genéricos, productos de marcas y cadenas de Fast Food (McDonalds, Starbucks, etc.). Todos los valores nutricionales están normalizados a 100g (`kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g`).
2.  **`user_foods`**: Alimentos personalizados y recetas creadas específicamente por el usuario.

**Nota**: La tabla `foods` ha sido deprecada. Toda la lógica de búsqueda y mapeo de alimentos genéricos ahora utiliza exclusivamente `generic_foods`.

---

## 📋 Esquema de Base de Datos (Supabase)

### Tabla Principal: `generic_foods` (Única fuente de alimentos comunitarios)

| Campo            | Tipo      | Descripción                                                                                                                                  |
| :--------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | uuid      | Identificador único del alimento                                                                                                             |
| `name_es`        | text      | Nombre limpio en español (ej: "Plátano", "Big Mac"). Sin sufijos de peso.                                                                    |
| `name_norm`      | text      | Nombre normalizado (sin tildes, minúsculas) para búsqueda eficiente                                                                          |
| `aliases_search` | text      | Términos de búsqueda normalizados (ej: "palta aguacate vianesa"). Usado para búsquedas flexibles.                                            |
| `barcode`        | text      | Código de barras (EAN-13, UPC, etc.). Búsqueda local por barcode cuando el producto no está en Open Food Facts. Índice único cuando no nulo. |
| `base_unit`      | text      | Unidad base: `g` (gramos) o `ml` (mililitros). Valores nutricionales por 100g o 100ml. Por defecto `g`.                                      |
| `kcal_100g`      | numeric   | **Calorías por cada 100g de producto** (siempre normalizado a 100g)                                                                          |
| `protein_100g`   | numeric   | **Proteínas (g) por cada 100g** (siempre normalizado a 100g)                                                                                 |
| `carbs_100g`     | numeric   | **Carbohidratos (g) por cada 100g** (siempre normalizado a 100g)                                                                             |
| `fat_100g`       | numeric   | **Grasas (g) por cada 100g** (siempre normalizado a 100g)                                                                                    |
| `unit_label_es`  | text      | **Etiqueta natural (ej: "1 unidad", "1 slice", "1 presa")**.                                                                                 |
| `grams_per_unit` | numeric   | Peso real en gramos de la unidad descrita. Usado para calcular macros cuando el usuario ingresa por unidades.                                |
| `tags`           | text[]    | Tags para categorización (ej: ["proteina", "fastfood"])                                                                                      |
| `created_at`     | timestamp | Fecha de creación                                                                                                                            |

**Importante**: Todos los valores nutricionales en `generic_foods` están normalizados a 100g. Para calcular macros de una cantidad específica, usar la fórmula: `(valor_100g / 100) * cantidad_en_gramos`.

### Tabla: `user_favorites`

| Campo        | Tipo      | Descripción                                      |
| :----------- | :-------- | :----------------------------------------------- |
| `id`         | uuid      | Identificador único del favorito                 |
| `user_id`    | uuid      | UUID del usuario (FK a auth.users.id)            |
| `food_id`    | uuid      | ID del alimento favorito (FK a generic_foods.id) |
| `created_at` | timestamp | Fecha de creación del favorito                   |

**Políticas RLS**:

- Los usuarios solo pueden ver, insertar y eliminar sus propios favoritos
- Ver archivo `supabase/migrations/user_favorites_rls.sql` para las políticas completas

### Tabla: `user_foods` (Alimentos/recetas del usuario)

| Campo          | Tipo      | Descripción |
| :------------- | :-------- | :---------- |
| `id`           | uuid      | Identificador único del alimento/receta |
| `user_id`      | uuid      | UUID del usuario (FK a auth.users.id) |
| `base_food_id` | uuid      | (nullable) Referencia opcional a un alimento base |
| `name`         | text      | Nombre del alimento/receta |
| `category`     | text      | Categoría (ej: `"receta"`) |
| `portion_unit` | text      | Unidad de porción (ej: `"g"`) |
| `portion_base` | numeric   | Base de porción (ej: gramos totales de la receta) |
| `calories`     | numeric   | Calorías (kcal) de la porción base |
| `protein`      | numeric   | Proteínas (g) de la porción base |
| `carbs`        | numeric   | Carbohidratos (g) de la porción base |
| `fat`          | numeric   | Grasas (g) de la porción base |
| `ingredients`  | jsonb     | **(nuevo)** Lista de ingredientes serializados (snapshot) para re-edición de la receta |
| `created_at`   | timestamp | Fecha de creación |

**Políticas RLS**:

- Los usuarios solo pueden ver, insertar, actualizar y eliminar sus propios alimentos/recetas (por `user_id`)

### Tabla: `profiles`

| Campo        | Tipo    | Descripción                                                              |
| :----------- | :------ | :----------------------------------------------------------------------- |
| `id`         | uuid    | UUID del usuario (FK a auth.users.id)                                    |
| `avatar_url` | text    | URL pública del avatar almacenado en Supabase Storage (bucket `avatars`) |
| `full_name`  | text    | Nombre completo del usuario                                              |
| `email`      | text    | Email del usuario                                                        |
| `is_premium` | boolean | Estado de suscripción premium                                            |

### Supabase Storage: Bucket `avatars`

- **Nombre de archivo**: `${userId}_avatar.jpg`
- **Compresión**: Calidad 0.4, máximo 500x500px
- **RLS**: Usuarios pueden subir/actualizar su propio avatar, todos pueden leer avatares públicos

---

## 🤖 Directrices para el Agente (Prompt del Sistema)

1.  **Prioriza términos Chilenos**: Usa siempre "Palta", "Marraqueta", "Vienesas", "Frutillas", "Zapallo Italiano", "Porotos".
2.  **Confirmación Proactiva**:
    - Usuario: "Me comí 2 naranjas".
    - Agente: (Busca `naranja`, `grams_per_unit: 130`, `unit_label_es: "1 unidad"`) -> "¡Registrado! 2 unidades de Naranja (~260g). Total: 122 kcal."
3.  **Manejo de Gramos Manuales**: Si el usuario entrega el peso (ej: "150g de arroz"), ignora el `grams_per_unit` y calcula directamente usando los valores por 100g.
4.  **Manejo de Nulos**: Si `grams_per_unit` es nulo o 0, solicita el peso al usuario: "¿Cuánto pesaba aproximadamente o de qué tamaño era?".
5.  **Cálculo Automático**: Realiza siempre la conversión: `(Valor_Macro_100g / 100) * peso_final`.

---

## ⚠️ Reglas Técnicas y de Limpieza

### Búsqueda de Alimentos

- **Tabla única**: Usar exclusivamente `generic_foods` para alimentos comunitarios.
- **Campos de búsqueda**:
  - `name_norm`: Nombre normalizado (sin tildes, minúsculas) - búsqueda exacta
  - `aliases_search`: Términos de búsqueda normalizados - búsqueda flexible
- **Query normalizada**: Siempre normalizar la query del usuario antes de buscar (quitar tildes, minúsculas).
- **Ejemplo de búsqueda**:
  ```sql
  .or(`name_norm.ilike.%${normalizedQuery}%,aliases_search.ilike.%${normalizedQuery}%`)
  ```

### Cálculo de Macros

- **Base siempre 100g**: Todos los valores en `generic_foods` están normalizados a 100g.
- **Fórmula**: `(valor_100g / 100) * cantidad_en_gramos`
- **Para unidades**: Si el usuario ingresa por unidades, primero convertir a gramos: `cantidad_unidades * grams_per_unit`, luego aplicar la fórmula.

### Otros

- **Fechas**: Los registros en `food_logs` deben guardarse con el campo `day` en formato `YYYY-MM-DD`.
- **Limpieza de Escala**: Si detectas valores de `kcal_100g` absurdos (ej: > 900), asume que el dato requiere normalización (dividir por 100).
- **Formato de Salida**:
  - Calorías: Número entero.
  - Macros: 1 decimal.
  - Peso: Siempre indicar el peso estimado en gramos entre paréntesis `(~Xg)`.
