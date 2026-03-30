// src/presentation/hooks/tour/TourProvider.tsx
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { TOUR_STEPS, TourStepDef } from "@/core/constants/tourSteps";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { router, usePathname } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type SpotlightLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TourContextValue = {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TourStepDef | null;
  getLayout: (stepId: string) => SpotlightLayout | null;
  reportLayout: (stepId: string, layout: SpotlightLayout) => void;
  nextStep: () => Promise<void>;
  skipTour: () => Promise<void>;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
}

/** Mapea el nombre corto de screen a su pathname de expo-router */
function screenToPathname(screen: string): string {
  switch (screen) {
    case "home":     return "/(tabs)/home";
    case "diary":    return "/(tabs)/diary";
    case "add-food": return "/(tabs)/add-food";
    default:         return "";
  }
}

/** Normaliza pathnames para comparación (considera variantes con/sin grupo) */
function pathnameMatchesScreen(pathname: string, screen: string): boolean {
  const expected = screenToPathname(screen);
  return pathname === expected || pathname === `/${screen}`;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const layoutMapRef = useRef<Map<string, SpotlightLayout>>(new Map());
  const [layoutToken, setLayoutToken] = useState(0);

  // Flag: nextStep navegó a otra pantalla y espera que pathname cambie
  // antes de incrementar el índice. Usamos ref para no re-disparar efectos.
  const pendingNextIndexRef = useRef<number | null>(null);

  const { session, profile } = useAuth();
  const pathname = usePathname();

  // ── Efecto 1: Activación inicial ──────────────────────────────────────────
  // Solo se ocupa de mostrar el tour por primera vez.
  // No depende de isActive para evitar loops.
  useEffect(() => {
    if (!session || !profile?.onboarding_completed) {
      setIsActive(false);
      return;
    }

    const onHome =
      pathname === "/(tabs)/home" || pathname === "/home";

    if (!onHome) return; // En otras pantallas no hacemos nada aquí

    storage.getString(StorageKeys.FEATURE_TOUR_SEEN).then((val) => {
      if (val !== "true") {
        setCurrentStepIndex(0);
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    });
  }, [session, profile?.onboarding_completed, pathname]);

  // ── Efecto 2: Avance de step cuando la navegación se completó ─────────────
  // Se dispara con cada cambio de pathname. Si había un step pendiente
  // y ahora estamos en la pantalla correcta, avanza el índice.
  useEffect(() => {
    const pending = pendingNextIndexRef.current;
    if (pending === null) return;

    const expectedStep = TOUR_STEPS[pending];
    if (!expectedStep) return;

    if (pathnameMatchesScreen(pathname, expectedStep.screen)) {
      pendingNextIndexRef.current = null;
      setCurrentStepIndex(pending);
    }
  }, [pathname]);

  const reportLayout = useCallback((stepId: string, layout: SpotlightLayout) => {
    layoutMapRef.current.set(stepId, layout);
    setLayoutToken((t) => t + 1);
  }, []);

  const getLayout = useCallback(
    (stepId: string): SpotlightLayout | null => {
      void layoutToken;
      return layoutMapRef.current.get(stepId) ?? null;
    },
    [layoutToken],
  );

  const completeTour = useCallback(async () => {
    await storage.setString(StorageKeys.FEATURE_TOUR_SEEN, "true");
    setIsActive(false);
  }, []);

  const nextStep = useCallback(async () => {
    const current = TOUR_STEPS[currentStepIndex];
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= TOUR_STEPS.length) {
      await completeTour();
      return;
    }

    if (current.navigateTo) {
      // Registrar el índice pendiente ANTES de navegar para que el
      // efecto 2 lo encuentre cuando pathname cambie.
      pendingNextIndexRef.current = nextIndex;
      router.push(current.navigateTo as any);
      // NO llamamos setCurrentStepIndex aquí — lo hace el efecto 2.
      return;
    }

    // Sin navegación: avanzar inmediatamente
    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, completeTour]);

  const skipTour = useCallback(async () => {
    pendingNextIndexRef.current = null;
    await completeTour();
  }, [completeTour]);

  const currentStep = isActive ? (TOUR_STEPS[currentStepIndex] ?? null) : null;

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStepIndex,
        currentStep,
        getLayout,
        reportLayout,
        nextStep,
        skipTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}
