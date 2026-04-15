# ContaMacros - Documentación del Proyecto

**Última actualización:** 14 de abril, 2026

## 🎯 Descripción General

ContaMacros es una app móvil (iOS y Android) para contar calorías y macronutrientes, enfocada en el mercado chileno. Ayuda a personas que quieren subir o bajar de peso mediante el seguimiento de su alimentación diaria.

**Estado actual:** ✅ **AMBAS PUBLICADAS**
- Android: https://play.google.com/store/apps/details?id=com.codeamusdev2.contamacro
- iOS: https://apps.apple.com/app/contamacros-calor%C3%ADas-y-dieta/id6758101956

---

## 🏗️ Stack Técnico

- **Framework:** React Native con Expo
- **Enrutamiento:** Expo Router (file-based routing)
- **Estado Global:** Zustand
- **Base de Datos:** Supabase (PostgreSQL + Realtime)
- **Autenticación:** Supabase Auth (Apple, Email)
- **IA:** Google Generative AI (Gemini)
- **Pagos:** RevenueCat (in-app subscriptions)
- **Health Integration:** Apple HealthKit, Health Connect (Android)
- **Lenguaje:** TypeScript

### Dependencias Principales
```json
{
  "expo": "~54.0.31",
  "react-native": "0.81.5",
  "react": "19.1.0",
  "@supabase/supabase-js": "^2.90.1",
  "@google/generative-ai": "^0.24.1",
  "react-native-purchases": "^9.7.1",
  "expo-camera": "~17.0.10",
  "zustand": "^5.0.3"
}
```

---

## 📱 Arquitectura de Carpetas

```
contamacro/
├── app/                           # Rutas (Expo Router)
│   ├── (tabs)/                   # Tabs principales
│   │   ├── diary.tsx            # Diario de macros
│   │   ├── scan.tsx             # Escaneo de códigos
│   │   ├── my-foods.tsx         # Mis comidas guardadas
│   │   └── settings.tsx         # Configuración
│   ├── add-food.tsx             # Agregar comida manual
│   └── create-recipe.tsx        # Crear recetas
│
├── src/
│   ├── domain/                   # Lógica de negocio
│   │   ├── models/              # Types y interfaces
│   │   ├── services/            # Servicios core
│   │   └── repositories/        # Repositorios
│   │
│   ├── data/                     # Acceso a datos
│   │   ├── food/                # Repositorios de comidas
│   │   ├── ai/                  # Servicios de IA
│   │   └── health/              # Integración Health
│   │
│   └── presentation/            # Interfaz
│       ├── components/          # Componentes reutilizables
│       ├── hooks/               # Custom hooks
│       ├── screens/             # Pantallas
│       ├── theme/               # Sistema de diseño
│       └── utils/               # Utilidades
```

---

## 🎨 Sistema de Diseño

### Colores (Dark Mode)
- **brand:** #22C55E (verde aguacate)
- **dark:** #1B3A2F (fondo base)
- **surface:** #1f4237 (superficies)
- **textPrimary:** #F6F7EB (texto principal)
- **textSecondary:** #9CA3AF (texto secundario)
- **cta:** #FF6B6B (acciones críticas)

### Tipografía
- **Títulos:** Lora (700, 700 italic)
- **Subtítulos/Botones:** Nunito (700)
- **Cuerpo:** Work Sans Variable

### Componentes Comunes
- `PrimaryButton` - Botón principal (verde)
- `RatingPromptModal` - Modal de rating (después de primera comida)
- `PremiumPaywall` - Paywall de suscripción
- `DateHeader` - Selector de fecha
- `AnimatedMacroProgress` - Barra de progreso animada

---

## 🔑 Features Principales

### 1. **Escaneo de Código de Barras**
- Usa OpenFoodFacts API
- Soporta: EAN-13, UPC-A, UPC-E, EAN-8, Code128
- Fallback a crowdsourcing si código no existe

### 2. **Escaneo con IA**
- Toma foto del plato
- Google Gemini detecta alimento, porción y macros
- Requiere plan premium

### 3. **Fitness Coach Pro** (v2 implementado)
- Asistente conversacional con historial
- Entiende objetivos, macros restantes, alimentos favoritos
- Sugiere recetas y rutinas de ejercicio
- Premium feature

### 4. **Integración Health**
- Apple HealthKit (iOS)
- Health Connect (Android)
- Sincroniza calorías quemadas
- Ajusta meta calórica diaria (premium)

### 5. **Smart Rating Prompt**
- Aparece después de registrar primera comida
- Respeta cooldown de 180 días
- No invasivo, máx 3 prompts por usuario
- Triggers: `first_meal_logged`, `first_ai_scan`, `7_day_streak`, `goal_hit`

### 6. **Suscripciones**
- **Free:** Registro básico, historial limitado
- **Premium Mensual:** $4.990 CLP/mes (sin trial)
- **Premium Anual:** $29.990 CLP/año (7 días gratis)
  - Fitness Coach Pro ilimitado
  - Escaneo IA ilimitado
  - Recetas personalizadas
  - Historial completo
  - Health Sync

---

## 🗄️ Base de Datos (Supabase)

### Tablas Principales
- **profiles** - Datos de usuario (meta calórica, macros objetivo, premium)
- **food_logs** - Comidas registradas por día
- **generic_foods** - BD de alimentos estándar
- **user_foods** - Alimentos personalizados del usuario
- **recipes** - Recetas guardadas
- **ai_scan_logs** - Historial de escaneos IA (para limitar a premium)
- **rating_prompt_state** - Estado de rating prompts (cooldown, count)

### Políticas RLS (Row Level Security)
- ✅ Usuarios solo ven sus propios datos
- ✅ Foods públicos (generic_foods) accesibles a todos
- ✅ User foods solo al dueño
- ✅ Health sync requiere premium (verificado en RLS)

---

## 🔄 Flujos Principales

### Flujo de Registro de Comida
```
1. Usuario abre app → va a Diary o Scan tab
2. Agrega comida:
   - Escanea código (barcode)
   - Usa IA (foto)
   - Busca en base de datos
   - Ingresa manual
3. Confirm modal muestra macros estimados
4. Usuario confirma
5. Se guarda en food_logs
6. Navega a Diary
7. Rating prompt aparece (primera vez)
```

### Flujo de Premium
```
1. Usuario intenta feature premium (Health Sync, IA scan ilimitado)
2. RevenueCat paywall aparece
3. Usuario compra
4. RevenueCat actualiza estado
5. `useRevenueCat()` hook obtiene `isPremium`
6. Features se activan automáticamente
```

---

## 🧪 Testing & Debugging

### Reset de Rating Prompt (Testing)
```typescript
// En diary.tsx línea ~110
await ratingPromptService.reset(); // Borra cooldown
```

### Logs Importantes
- `[DiaryScreen]` - Logs del diario
- `[RatingPrompt]` - Logs del rating system
- `[HealthSync]` - Logs de sincronización
- `[FitnessCoach]` - Logs de coach

### Modo Debug
```bash
npm start
```
Luego escanea QR con Expo Go en tu celu.

---

## 📝 Convenciones

### Naming
- Archivos: `camelCase.tsx`
- Componentes: `PascalCase`
- Funciones: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Tipos/Interfaces: `PascalCase`

### Estructura de Componentes
```typescript
// Imports
import { useHook } from '@/path';

// Interface/Type
interface ComponentProps { }

// Component
export function Component({ prop }: ComponentProps) {
  // Hooks
  const { } = useHook();
  
  // State
  const [state, setState] = useState();
  
  // Effects
  useEffect(() => { }, []);
  
  // Handlers
  const handleClick = () => { };
  
  // Render
  return <View>...</View>;
}
```

### Commits
Estructura recomendada:
```
feat: agregar Smart Rating Prompt
fix: corregir bug de health sync
refactor: mejorar lógica de macros
docs: actualizar documentación
```

---

## 🚀 Deployment

### iOS (App Store)
```bash
# Build local
eas build --platform ios --profile production --local

# Submit a App Store
eas submit --platform ios --profile production
```

### Android (Google Play)
```bash
# Build local
eas build --platform android --profile production --local

# Submit a Play Store
eas submit --platform android --profile production
```

Ambas apps ya están publicadas. Para actualizaciones:
1. Bump version en `app.json`
2. Build localmente o vía EAS
3. Submit a tienda

---

## 📊 Métricas Importantes

### KPIs
- **DAU (Daily Active Users):** Usuarios activos diarios
- **Retention:** % de usuarios que vuelven día siguiente
- **Premium Conversion:** % de usuarios que compran
- **LTV (Lifetime Value):** Ingresos promedio por usuario
- **CAC (Customer Acquisition Cost):** Costo de adquirir usuario

### Tracking
- RevenueCat: Suscripciones y compras
- Supabase Analytics: Eventos de app
- Google Play Console: Descargas, ratings

---

## 🔐 Seguridad

### Autenticación
- Supabase Auth (Apple, Email)
- Session tokens en AsyncStorage (encriptado)
- Refresh tokens automáticos

### Datos Sensibles
- Calorías, macros: encriptados en tránsito (HTTPS)
- Health data: nunca almacenado en servidor (solo sincroniza)
- Premium status: fuente de verdad en RevenueCat

### RLS Policies
- Todos los datos están bajo RLS
- Usuarios solo pueden leer/escribir sus propios datos
- Premium checks en nivel BD (auditable)

---

## 🐛 Troubleshooting

### La app no compila
```bash
npm install
npx expo-cli prebuild --clean
npm start
```

### Health Sync no funciona
- Verificar que usuario es premium (RevenueCat)
- En iOS: Settings → Privacy → Health
- En Android: Health Connect → Permisos

### Rating prompt no aparece
- Resetear: `ratingPromptService.reset()`
- Verificar logs: `[RatingPrompt]`
- Revisar cooldown en AsyncStorage

### Supabase offline
- Verificar SUPABASE_URL y SUPABASE_KEY en `.env`
- Check: supabase.com/status

---

## 📚 Referencias

### Documentos Auxiliares
- `/docs/DATABASE_SCHEMA.md` - Esquema BD detallado
- `/docs/NAVIGATION_FLOW.md` - Flujos de navegación
- `/docs/FREE_VS_PREMIUM.md` - Features por plan
- `/docs/FITNESS_COACH_PRO.md` - Implementación de coach

### Links Útiles
- **Expo Docs:** https://docs.expo.dev
- **React Native:** https://reactnative.dev
- **Supabase:** https://supabase.com/docs
- **RevenueCat:** https://www.revenuecat.com/docs
- **Google Gemini API:** https://ai.google.dev/

---

## 👨‍💻 Contacto & Soporte

**Mantenedor:** Matias  
**Email:** matias04041994@gmail.com  
**Repositorio:** TBD  

Para preguntas sobre arquitectura, features o bugs, revisar memoria del proyecto en `/mnt/.auto-memory/`.
