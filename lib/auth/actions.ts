"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function buildCallbackUrl(next?: string) {
  const base = `${getSiteUrl()}/auth/callback`;
  if (next && next.startsWith("/")) {
    return `${base}?next=${encodeURIComponent(next)}`;
  }
  return base;
}

export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "").trim();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildCallbackUrl(next || undefined),
      // Safari often reuses the last Google session without an account picker;
      // Chrome already prompts. Force chooser so multi-account households can switch.
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Could not start Google sign-in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}