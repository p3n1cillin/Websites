"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(formData: FormData): {
  email: string;
  password: string;
  error?: string;
} {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  if (!EMAIL_RE.test(email)) return { email, password, error: "Enter a valid email." };
  if (password.length < 8)
    return { email, password, error: "Password must be at least 8 characters." };
  return { email, password };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, error } = readCredentials(formData);
  if (error) return { error };

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) return { error: signInError.message };

  const next = (formData.get("next") as string | null) || "/admin";
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, error } = readCredentials(formData);
  if (error) return { error };

  const supabase = await createSupabaseServerClient();
  const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) return { error: signUpError.message };

  // If email confirmation is enabled there is no session yet.
  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
