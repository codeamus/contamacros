// src/domain/services/authService.ts
import { supabase } from "@/data/supabase/supabaseClient";
import type { ProfileDb } from "@/domain/models/profileDb";
import type { Session, User } from "@supabase/supabase-js";
import { mapProfileDb } from "../mappers/profileMapper";

type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

function mapSupabaseError(e: unknown): { message: string; code?: string } {
  if (typeof e === "object" && e && "message" in e) {
    const msg = String((e as any).message);
    const code = (e as any).code ? String((e as any).code) : undefined;
    return { message: msg, code };
  }
  return { message: "Ocurrió un error inesperado." };
}

export const AuthService = {
  async signUp(
    email: string,
    password: string
  ): Promise<AuthResult<{ user: User; session: Session | null }>> {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data.user)
        return { ok: false, message: "No se pudo crear el usuario." };

      return {
        ok: true,
        data: { user: data.user, session: data.session ?? null },
      };
    } catch (e) {
      return { ok: false, ...mapSupabaseError(e) };
    }
  },

  async signIn(email: string, password: string): Promise<AuthResult<Session>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data.session)
        return { ok: false, message: "No se pudo iniciar sesión." };
      return { ok: true, data: data.session };
    } catch (e) {
      return { ok: false, ...mapSupabaseError(e) };
    }
  },

  async signOut(): Promise<AuthResult<true>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, ...mapSupabaseError(e) };
    }
  },

  async getSession(): Promise<AuthResult<Session | null>> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: data.session ?? null };
    } catch (e) {
      return { ok: false, ...mapSupabaseError(e) };
    }
  },

  onAuthStateChange(cb: (session: Session | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      cb(session ?? null);
    });
    return () => data.subscription.unsubscribe();
  },

  // -------- Profiles (DB) --------

  async getMyProfile(): Promise<AuthResult<ProfileDb | null>> {
    try {
      const { data: sdata, error: serr } = await supabase.auth.getSession();
      if (serr) return { ok: false, message: serr.message };
      const uid = sdata.session?.user?.id;
      if (!uid) return { ok: true, data: null };

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data) return { ok: true, data: null };

      // ✅ Normaliza (weight_kg numeric -> number)
      const normalized = mapProfileDb(data as ProfileDb);

      return { ok: true, data: normalized };
    } catch (e) {
      return { ok: false, ...mapSupabaseError(e) };
    }
  },

  async updateMyProfile(
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
  ): Promise<AuthResult<ProfileDb>> {
    try {
      const { data: sdata, error: serr } = await supabase.auth.getSession();
      if (serr) return { ok: false, message: serr.message };
      const uid = sdata.session?.user?.id;
      if (!uid) return { ok: false, message: "No hay sesión activa." };

      const { data, error } = await supabase
        .from("profiles")
        .update(input)
        .eq("id", uid)
        .select("*")
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data)
        return {
          ok: false,
          message: "No se pudo actualizar el perfil (sin filas).",
        };

      return { ok: true, data: data as ProfileDb };
    } catch (e) {
      return { ok: false, ...mapSupabaseError(e) };
    }
  },
};
