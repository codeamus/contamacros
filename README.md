# ContaMacros — App móvil para contar calorías y macros

App móvil (iOS + Android) para contar calorías y macronutrientes con enfoque en el mercado chileno.

**Estado actual:** ✅ Publicada en ambas tiendas
- Android: https://play.google.com/store/apps/details?id=com.codeamusdev2.contamacro
- iOS: https://apps.apple.com/app/contamacros-calor%C3%ADas-y-dieta/id6758101956

---

## 🚀 Inicio Rápido

```bash
npm install                # Instalar dependencias
npm start                  # Iniciar en desarrollo (escanea QR con Expo Go)
npm run android           # Emulador Android
npm run ios              # Simulador iOS
```

---

## 📖 Documentación

**Para documentación completa del proyecto, ver [`CLAUDE.md`](./CLAUDE.md)**

Incluye:
- ✅ Stack técnico
- ✅ Arquitectura de carpetas
- ✅ Features principales
- ✅ Base de datos (Supabase)
- ✅ Sistema de diseño
- ✅ Flujos de usuario
- ✅ Troubleshooting

---

## 📱 Features Principales

| Feature | Descripción |
|---------|-------------|
| **Escaneo código de barras** | OpenFoodFacts API — detecta producto y macros |
| **Escaneo IA de platos** | Google Gemini — foto → alimento, porción y macros |
| **Fitness Coach Pro** | Asistente IA conversacional con historial |
| **Health Sync** | Apple HealthKit / Health Connect — calorías quemadas |
| **Premium Features** | Coach ilimitado, IA ilimitada, historial completo |
| **Smart Rating Prompt** | Pide rating después de primera comida (no invasivo) |

---

## 💰 Planes

| Plan | Precio | Trial |
|------|--------|-------|
| Gratuito | $0 | — |
| Mensual | $4.990 CLP | — |
| Anual | $29.990 CLP | **7 días** |

---

## 🏗️ Stack

- **Frontend:** React Native + Expo Router
- **Backend:** Supabase (PostgreSQL + Auth)
- **IA:** Google Gemini
- **Pagos:** RevenueCat
- **Health:** HealthKit / Health Connect
- **Language:** TypeScript

---

## 📚 Documentación Auxiliar

Documentos adicionales en `/docs/`:
- `DATABASE_SCHEMA.md` — Esquema BD
- `NAVIGATION_FLOW.md` — Flujos de navegación
- `FITNESS_COACH_PRO.md` — Arquitectura del coach

---

## 👨‍💻 Desarrollo

**Mantenedor:** Matias  
**Email:** matias04041994@gmail.com

Para preguntas sobre desarrollo, arquitectura o features, consultar [`CLAUDE.md`](./CLAUDE.md).
