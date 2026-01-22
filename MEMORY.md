# 🧠 MEMORY.md - Memoria a Largo Plazo del Proyecto

Este archivo actúa como memoria persistente del proyecto **ContaMacros**. Úsalo como referencia para mantener consistencia y contexto.

---

## 📁 Estructura del Proyecto

### Pantallas (app/)
```
app/
├── (auth)/              # Flujo de autenticación
│   ├── login.tsx
│   └── register.tsx
├── (onboarding)/        # Onboarding inicial
│   ├── about.tsx
│   ├── activity.tsx
│   ├── goal.tsx
│   ├── profile.tsx
│   └── result.tsx
└── (tabs)/              # Pantallas principales (con tab bar)
    ├── home.tsx          # Resumen diario, Smart Coach
    ├── diary.tsx         # Diario de comidas por día
    ├── add-food.tsx      # Búsqueda y agregar alimentos
    ├── my-foods.tsx      # Recetas y alimentos personalizados
    ├── settings.tsx      # Perfil, configuración, premium
    ├── scan.tsx          # Scanner de códigos de barras
    ├── calendar.tsx      # Vista de calendario (oculta en tabs)
    └── ranking.tsx       # Top Creadores (oculta en tabs)
```

### Servicios (src/domain/services/)
```
src/domain/services/
├── authService.ts           # Autenticación, perfiles
├── calorieGoals.ts          # Cálculo de calorías diarias
├── macroTargets.ts          # Cálculo de macros (proteína, carbos, grasas)
├── gamificationService.ts   # XP, niveles, streaks, achievements, ranking
└── revenueCatService.ts     # Suscripciones premium
```

### Repositorios (src/data/)
```
src/data/
├── auth/
│   └── authRepository.ts
├── food/
│   ├── foodLogRepository.ts      # Registro de comidas
│   ├── foodsRepository.ts        # Alimentos genéricos (legacy)
│   ├── genericFoodsRepository.ts # Alimentos comunitarios (fuente principal)
│   └── userFoodsRepository.ts   # Alimentos/recetas del usuario
├── openfoodfacts/
│   └── openFoodFactsService.ts   # Integración con OpenFoodFacts
├── profile/
│   └── profileRepository.ts
└── supabase/
    └── supabaseClient.ts
```

### Componentes (src/presentation/components/)
```
src/presentation/components/
├── auth/
│   └── AuthTextField.tsx
├── nutrition/
│   ├── AchievementsList.tsx      # Lista de logros
│   ├── CreateFoodModal.tsx       # Modal para crear alimentos comunitarios
│   └── ProgressCard.tsx          # Progreso (XP, nivel, streak)
├── premium/
│   ├── CustomerCenter.tsx        # Gestión de suscripción
│   └── PremiumPaywall.tsx       # Paywall de suscripción
├── smartCoach/
│   └── SmartCoachPro.tsx         # Coach inteligente (solo premium)
└── ui/
    ├── DateHeader.tsx
    ├── DonutRing.tsx
    ├── PrimaryButton.tsx
    ├── Skeleton.tsx
    └── Toast.tsx
```

### Hooks (src/presentation/hooks/)
```
src/presentation/hooks/
├── auth/
│   └── AuthProvider.tsx          # Context de autenticación
├── diary/
│   ├── useCalendarData.ts
│   ├── useTodayMeals.ts
│   └── useTodaySummary.ts
├── health/
│   └── useHealthSync.ts           # Sincronización con Apple Health/Health Connect
├── smartCoach/
│   └── useSmartCoachPro.ts       # Lógica del Smart Coach
├── subscriptions/
│   ├── usePremium.ts
│   └── useRevenueCat.ts          # Hook principal para RevenueCat
└── ui/
    ├── useAnimatedValue.ts
    ├── useStaggerAnimation.ts
    └── useToast.tsx
```

---

## 🛠 Stack Tecnológico

### Versiones Principales
- **Expo SDK:** `~54.0.31`
- **React:** `19.1.0`
- **React Native:** `0.81.5`
- **TypeScript:** `5.9.3`
- **Expo Router:** `~6.0.21`

### Dependencias Clave
- **Supabase JS:** `^2.90.1`
- **RevenueCat Purchases:** `^9.7.1`
- **RevenueCat Purchases UI:** `^9.7.1`
- **Zustand:** `^5.0.3` (state management)
- **Expo Camera:** `~17.0.10` (scanner)
- **Expo Haptics:** `~15.0.8` (feedback táctil)
- **Expo Linear Gradient:** `~15.0.8` (gradientes, actualmente no usado por problemas de módulo nativo)

### Configuración
- **Bundle ID iOS:** `com.codeamusdev2.contamacro`
- **Package Android:** `com.codeamusdev2.contamacro`
- **RevenueCat Entitlement ID:** `"ContaMacros Pro"`
- **RevenueCat API Key iOS:** `appl_YefJRBImlNCzKtxjKjWOtrUMsSo`

---

## ⚡ Reglas de Oro

### Convenciones de Código
1. **Nomenclatura:**
   - Variables y funciones: `camelCase`
   - Componentes: `PascalCase`
   - Constantes: `UPPER_SNAKE_CASE`
   - Tipos/Interfaces: `PascalCase` (ej: `UserStats`, `LeaderboardEntry`)

2. **Paths y Aliases:**
   - Usar `@/` para imports desde `src/`
   - Ejemplo: `import { useAuth } from "@/presentation/hooks/auth/AuthProvider"`

3. **Estructura de Archivos:**
   - Servicios en `src/domain/services/`
   - Repositorios en `src/data/`
   - Componentes en `src/presentation/components/`
   - Hooks en `src/presentation/hooks/`

### Base de Datos (Supabase)
1. **Esquema:**
   - Todas las tablas están en el esquema `public` (por defecto)
   - No especificar esquema explícitamente en queries

2. **Identificadores:**
   - El ID de usuario es un **UUID** (viene de `auth.users.id`)
   - Las tablas relacionadas usan `user_id` como FK (excepto `user_stats` que usa `id` como PK y relación directa con `profiles.id`)

3. **Tablas Principales:**
   - `profiles`: Perfil del usuario (id = UUID del auth.users)
   - `user_stats`: Estadísticas de gamificación (id = UUID, relación directa con profiles.id)
   - `generic_foods`: Alimentos comunitarios (fuente principal)
   - `user_foods`: Alimentos/recetas personalizados del usuario
   - `food_logs`: Registro diario de comidas
   - `user_achievements`: Logros desbloqueados

4. **Relaciones:**
   - `user_stats.id` → `profiles.id` (relación directa, no usa `user_id`)
   - Para JOINs: usar `profiles!inner(...)` o `profiles(...)` según la relación
   - **IMPORTANTE:** `user_stats` se relaciona con `profiles` a través de `id`, no `user_id`

5. **Columnas Importantes:**
   - `profiles.full_name`: Nombre del usuario (editable desde settings)
   - `profiles.avatar_url`: URL pública del avatar del usuario (almacenado en Supabase Storage, bucket `avatars`)
   - `profiles.is_premium`: Estado premium (se sincroniza con RevenueCat)
   - `user_stats.contribution_count`: Número de alimentos creados (para ranking)
   - `user_stats.xp_points`: Puntos de experiencia
   - `user_stats.level`: **NO existe en BD**, se calcula dinámicamente con `calculateLevel(xp_points)`

6. **Supabase Storage:**
   - Bucket `avatars`: Almacena los avatares de los usuarios
   - Nombre de archivo: `${userId}_avatar.jpg`
   - Políticas RLS: Usuarios pueden subir/actualizar su propio avatar, todos pueden leer avatares públicos
   - Compresión: Imágenes se comprimen a calidad 0.4 y máximo 500x500px antes de subir

### Lógica de Negocio
1. **Cálculo de Macros:**
   - Fórmula: `(Macro_100g / 100) * cantidad_gramos`
   - Si hay `grams_per_unit`, usar: `(Macro_100g / 100) * (unidades * grams_per_unit)`

2. **Gamificación:**
   - Crear alimento: +50 XP
   - Primer log del día: +10 XP + streak
   - Niveles: `floor(sqrt(xp / 100))`
   - Rangos: Novato (0-500), Entusiasta (501-2000), Atleta (2001-5000), Master Pro (5000+)

3. **Premium:**
   - RevenueCat es la fuente de verdad
   - Fallback a `profile.is_premium` si RevenueCat no está disponible
   - Sincronizar `is_premium` en Supabase después de compra/restauración

4. **Unidades Naturales:**
   - Priorizar `grams_per_unit` y `unit_label_es` sobre pesaje manual
   - Si `grams_per_unit > 0`, proponer registro por unidades

### UI/UX
1. **Tema:**
   - Sistema de temas con soporte para light/dark/system
   - Colores y tipografía centralizados en `src/presentation/theme/`

2. **Navegación:**
   - Usar `expo-router` para navegación
   - Tabs visibles: Home, Diario, Mis comidas, Ajustes
   - Tabs ocultas: scan, calendar, ranking, add-food

3. **Feedback:**
   - Usar `expo-haptics` para feedback táctil
   - Toasts para mensajes informativos/errores

---

## ✅ Estado Actual de Funcionalidades

### Completadas y Funcionales
- ✅ **Autenticación:**
  - Login/Registro con email/password
  - OAuth con Google
  - Gestión de sesión y perfil

- ✅ **Onboarding:**
  - Flujo completo (goal, activity, profile, about, result)
  - Cálculo de calorías y macros iniciales

- ✅ **Home Screen:**
  - Resumen diario (calorías, macros)
  - Smart Coach Pro (solo premium)
  - Sincronización con Apple Health/Health Connect (solo premium)
  - Barras de progreso animadas

- ✅ **Diary Screen:**
  - Vista de comidas por día
  - Navegación por calendario
  - Edición y eliminación de registros

- ✅ **Add Food Screen:**
  - Búsqueda local (generic_foods, user_foods)
  - Búsqueda en OpenFoodFacts
  - Registro de alimentos con unidades o gramos
  - Historial de búsquedas

- ✅ **My Foods Screen:**
  - Creación de recetas personalizadas
  - Lista de alimentos del usuario
  - Scanner de códigos de barras (integración)

- ✅ **Settings Screen:**
  - Edición de perfil (nombre, peso, objetivo, actividad)
  - Gestión de tema
  - Acceso a suscripción premium
  - Secciones de gamificación (solo premium)

- ✅ **Gamificación:**
  - Sistema de XP y niveles
  - Racha diaria (streaks)
  - Achievements (logros)
  - Ranking "Top Creadores" (ordenado por `contribution_count`)
  - Rangos: Novato, Entusiasta, Atleta, Master Pro

- ✅ **Premium (RevenueCat):**
  - Paywall con planes mensual/anual
  - Sincronización de estado premium
  - Customer Center para gestión de suscripción
  - Feature flags para funcionalidades premium

- ✅ **Alimentos Comunitarios:**
  - Creación de alimentos por usuarios
  - Control de duplicados (fuzzy search con Levenshtein)
  - Recompensas de XP por contribuciones

### En Desarrollo / Issues Conocidos
- ⚠️ **Scanner de Códigos de Barras:**
  - Problema: El modal del alimento se oculta después de escanear
  - Estado: Parcialmente funcional (detecta código, busca producto, pero el modal desaparece)
  - Nota: Se agregaron logs detallados y protección contra limpieza prematura del estado

- ⚠️ **Linear Gradient:**
  - Problema: Módulo nativo no configurado (`expo-linear-gradient`)
  - Solución temporal: Reemplazado con `View` con `backgroundColor` sólido
  - Nota: Para usar gradientes reales, reconstruir proyecto nativo

### Pendientes / Roadmap
- 📋 **Insights/Analytics:**
  - Análisis de tendencias nutricionales
  - Gráficos de progreso
  - Recomendaciones personalizadas avanzadas

- 📋 **Mejoras de Scanner:**
  - Resolver problema de modal que desaparece
  - Mejorar manejo de estados entre navegación

- 📋 **Optimizaciones:**
  - Cache de búsquedas
  - Lazy loading de imágenes
  - Optimización de queries a Supabase

---

## 🔑 Configuración de Servicios Externos

### Supabase
- Variables de entorno: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- RLS (Row Level Security): Habilitado en tablas sensibles
- Políticas necesarias:
  - `user_stats`: SELECT público para ranking, UPDATE/INSERT solo propio
  - `profiles`: SELECT público para ranking, UPDATE solo propio
  - `generic_foods`: SELECT público, INSERT para usuarios autenticados
- **Storage (Bucket `avatars`):**
  - SELECT: Público (todos pueden leer avatares)
  - INSERT/UPDATE/DELETE: Solo usuarios autenticados
  - Ver `supabase/storage-policies-avatars.sql` para las políticas SQL completas

### RevenueCat
- API Key iOS: `appl_YefJRBImlNCzKtxjKjWOtrUMsSo`
- Entitlement ID: `"ContaMacros Pro"`
- Product IDs:
  - Mensual: `contamacros_month`
  - Anual: `contamacros_yearly`
- Configuración: StoreKit Configuration file en Xcode para desarrollo

### OpenFoodFacts
- API Base: `https://world.openfoodfacts.org`
- Endpoints:
  - Búsqueda: `/cgi/search.pl` (v1)
  - Por barcode: `/api/v2/product/{code}` (v2)

---

## 📝 Notas Importantes

1. **Nivel es Dinámico:**
   - La columna `level` NO existe en `user_stats`
   - Se calcula con `calculateLevel(xp_points)` en tiempo de ejecución
   - NO intentar leer/escribir `level` en la BD

2. **Ranking:**
   - Ordenado por `contribution_count DESC` (no por XP)
   - Muestra "Top Creadores" (usuarios que más alimentos han creado)
   - El rango (Novato, Atleta, etc.) se calcula con `getUserRank(xp_points)` pero no afecta el orden

3. **Premium Features:**
   - Ranking y Medallas: Solo visible para usuarios premium
   - Smart Coach Pro: Solo para premium
   - Health Sync: Solo para premium
   - Scanner ilimitado: Solo para premium (según feature flags)

4. **Scanner:**
   - Usa `useFocusEffect` para resetear estado al volver
   - Problema conocido: Modal desaparece después de escanear (en proceso de corrección)
   - Usa refs (`isBarcodeSearchRef`, `justProcessedBarcodeRef`) para proteger el estado

5. **Nombres de Usuarios:**
   - Se editan desde Settings → Perfil → Nombre
   - Se actualiza en `profiles.full_name`
   - Se muestra en ranking y perfil

---

## 🚀 Comandos Útiles

```bash
# Desarrollo
npm start                    # Iniciar Expo
npm run ios                  # Ejecutar en iOS
npm run android              # Ejecutar en Android

# Linting
npm run lint                 # Verificar código

# Limpiar cache
rm -rf node_modules/.cache .expo
```

---

**Última actualización:** Enero 2025
**Versión del proyecto:** 1.0.0
