// src/presentation/hooks/auth/AuthProvider.tsx
import type { ProfileDb } from "@/domain/models/profileDb";
import { AuthService } from "@/domain/services/authService";
import type { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthState = {
  initializing: boolean;
  session: Session | null;
  profile: ProfileDb | null;

  signUp: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; message?: string }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;

  refreshProfile: () => Promise<ProfileDb | null>;
  updateProfile: (
    input: Partial<
      Pick<
        ProfileDb,
        | "full_name"
        | "height_cm"
        | "weight_kg"
        | "goal"
        | "onboarding_completed"
        | "protein_g"
        | "carbs_g"
        | "fat_g"
      >
    >
  ) => Promise<{ ok: boolean; message?: string }>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileDb | null>(null);

 async function refreshProfile(): Promise<ProfileDb | null> {
   for (let i = 0; i < 8; i++) {
     const res = await AuthService.getMyProfile();
     if (res.ok && res.data) {
       setProfile(res.data);
       return res.data;
     }
     await new Promise((r) => setTimeout(r, 250));
   }

   const last = await AuthService.getMyProfile();
   if (last.ok) {
     setProfile(last.data);
     return last.data;
   }
   return null;
 }





  useEffect(() => {
    let unsub: null | (() => void) = null;

    (async () => {
      const s = await AuthService.getSession();
      if (s.ok) setSession(s.data);
      if (s.ok && s.data) await refreshProfile();
      setInitializing(false);

      unsub = AuthService.onAuthStateChange(async (sess) => {
        setSession(sess);
        if (sess) await refreshProfile();
        else setProfile(null);
      });
    })();

    return () => unsub?.();
     
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      initializing,
      session,
      profile,

      signUp: async (email, password) => {
        const res = await AuthService.signUp(email, password);
        if (!res.ok) return { ok: false, message: res.message };

        // ✅ Fuerza obtener la sesión actual (más robusto que confiar en data.session)
        const s = await AuthService.getSession();
        if (s.ok) setSession(s.data);

        // ✅ Espera profile
        await refreshProfile();

        return { ok: true };
      },

      signIn: async (email, password) => {
        const res = await AuthService.signIn(email, password);
        if (!res.ok) return { ok: false, message: res.message };
        setSession(res.data);
        await refreshProfile();
        return { ok: true };
      },

      signOut: async () => {
        await AuthService.signOut();
        setSession(null);
        setProfile(null);
      },

      refreshProfile,

      updateProfile: async (input) => {
        const res = await AuthService.updateMyProfile(input);
        if (!res.ok) return { ok: false, message: res.message };
        setProfile(res.data);
        return { ok: true };
      },
    };
  }, [initializing, session, profile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
