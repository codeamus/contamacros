# ContaMacros — App móvil para contar calorías y macros

App móvil (iOS + Android) para contar calorías y macronutrientes con enfoque en el mercado chileno. Ayuda a personas a subir o bajar de peso mediante el seguimiento de su alimentación diaria.

**Estado:** Pre-lanzamiento. App en desarrollo activo.

---

## Stack Técnico

- **React Native + Expo** (Expo Router — file-based routing)
- **Supabase** (PostgreSQL, Auth, RLS)
- **Google Gemini 2.5 Flash** (IA: escaneo de platos + Fitness Coach Pro)
- **OpenFoodFacts API** (escaneo de código de barras)
- **RevenueCat** (gestión de suscripciones)
- **TypeScript** estricto

---

## Comandos

```bash
pnpm install        # Instalar dependencias
npx expo start      # Iniciar en desarrollo
npx expo start --ios     # Simulador iOS
npx expo start --android # Emulador Android
```

---

## Estructura del Proyecto

```
app/                    # Pantallas (Expo Router)
├── (tabs)/             # Tabs principales (home, diary, add-food, scan, etc.)
├── smart-coach-pro.tsx # Chat con Fitness Coach Pro
└── _layout.tsx         # Layout raíz

src/
├── data/               # Repositorios, servicios externos, IA
│   ├── ai/             # Servicios Gemini (coach, escaneo IA)
│   ├── repositories/   # Acceso a Supabase
│   └── services/       # OpenFoodFacts, etc.
├── domain/             # Tipos, modelos de dominio
└── presentation/
    ├── components/     # Componentes reutilizables
    └── hooks/          # Hooks de lógica de negocio

supabase/
└── seeds/              # Scripts SQL de seed
    └── generic_foods_chile.sql  # ~80 alimentos típicos chilenos

docs/                   # Documentación técnica
```

---

## Features Principales

| Feature | Descripción |
|---------|-------------|
| Registro de comidas | Búsqueda manual o por escaneo con cálculo automático de macros |
| Escaneo código de barras | OpenFoodFacts API — lee el código y busca en BD mundial |
| Escaneo IA de platos | Foto del plato → Gemini detecta alimento, porción y macros |
| Crowdsourcing | Si el barcode no existe, el usuario lo agrega para toda la comunidad |
| **Fitness Coach Pro** | Chat IA conversacional: recetas, planes, rutinas según macros del día |
| Health Sync | Apple Health (iOS) y Health Connect (Android) para calorías quemadas |
| Gamificación | XP, niveles, rachas diarias, logros, ranking de contribuidores |

---

## Planes y Precios

| Plan | Precio | Trial |
|------|--------|-------|
| Gratuito | $0 | — |
| Mensual | $4.990 CLP/mes | Sin trial |
| Anual | $29.990 CLP/año | **7 días gratis** |

El estado premium vive en `profiles.is_premium` (sincronizado con RevenueCat).

---

## Base de Datos

Schema completo en `docs/DATABASE_SCHEMA.md` y `docs/SUPABASE_REFERENCE.md`.

Tablas principales: `profiles`, `user_stats`, `generic_foods`, `user_foods`, `food_logs`, `activity_logs`, `user_achievements`.

---

## Documentación Técnica

| Documento | Descripción |
|-----------|-------------|
| `docs/FITNESS_COACH_PRO.md` | Arquitectura y flujo del Fitness Coach Pro (chat IA + recomendaciones) |
| `docs/DATABASE_SCHEMA.md` | Schema completo de todas las tablas |
| `docs/SUPABASE_REFERENCE.md` | Referencia rápida de columnas, RLS e índices |
| `docs/NAVIGATION_FLOW.md` | Flujo Scanner → AddFood → Diary con manejo de estados |
| `docs/free-vs-premium.md` | Modelo Free vs Premium y feature flags |
| `docs/TOUR_PROMPT.md` | Diseño del tour guiado para nuevos usuarios |
| `docs/calorie-goals.md` | Cálculo de TDEE y objetivos calóricos |
| `docs/user-profile.md` | Modelo de perfil de usuario |

---

## Sitio Web

El sitio web (landing page) está en el repositorio `contamacros-web` (Astro 5 + TailwindCSS).
Dominio: https://contamacros.cl
