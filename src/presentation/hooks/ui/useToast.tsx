// src/presentation/hooks/ui/useToast.tsx
import React, { createContext, useCallback, useContext, useState } from "react";
import { View } from "react-native";

import { Toast, type ToastConfig } from "@/presentation/components/ui/Toast";
import { useTheme } from "@/presentation/theme/ThemeProvider";

type ToastContextValue = {
  showToast: (config: ToastConfig) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const { theme } = useTheme();

  const showToast = useCallback((config: ToastConfig) => {
    setToast(config);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          {...toast}
          onHide={hideToast}
          colors={theme.colors}
          typography={theme.typography}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
