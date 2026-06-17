"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirectWithError("/auth/signup", "Supabase environment variables are not configured.");
  }

  const companyName = formValue(formData, "companyName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");

  if (!companyName || !email || !password) {
    redirectWithError("/auth/signup", "Company name, email, and password are required.");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_name: companyName,
      },
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=/`
        : undefined,
    },
  });

  if (error) {
    redirectWithError("/auth/signup", error.message);
  }

  redirect(
    "/auth/login?message=Account created. Check your email if confirmation is enabled, then sign in.",
  );
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirectWithError("/auth/login", "Supabase environment variables are not configured.");
  }

  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");

  if (!email || !password) {
    redirectWithError("/auth/login", "Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithError("/auth/login", error.message);
  }

  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirectWithError(
      "/auth/forgot-password",
      "Supabase environment variables are not configured.",
    );
  }

  const email = formValue(formData, "email").toLowerCase();

  if (!email) {
    redirectWithError("/auth/forgot-password", "Email is required.");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin
      ? `${origin}/auth/callback?next=/auth/update-password`
      : undefined,
  });

  if (error) {
    redirectWithError("/auth/forgot-password", error.message);
  }

  redirect(
    "/auth/forgot-password?message=Password reset instructions have been sent.",
  );
}

export async function updatePassword(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirectWithError(
      "/auth/update-password",
      "Supabase environment variables are not configured.",
    );
  }

  const password = formValue(formData, "password");

  if (!password) {
    redirectWithError("/auth/update-password", "New password is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirectWithError("/auth/update-password", error.message);
  }

  redirect("/?message=Password updated.");
}

export async function signOut() {
  if (!hasSupabaseConfig()) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
