"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/auth/actions";

type LoginFormProps = {
  next?: string;
  initialError?: string | null;
};

export function LoginForm({ next, initialError }: LoginFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();
  const isDev = process.env.NODE_ENV !== "production";

  function buildCallbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    // Ensures magic-link emails can append &token_hash=… (see supabase/templates/magic_link.html)
    url.searchParams.set("flow", "magiclink");
    if (next && next.startsWith("/")) {
      url.searchParams.set("next", next);
    }
    return url.toString();
  }

  const mailpitUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:54324`
      : "http://127.0.0.1:54324";

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          One less thing to manage. Sign in with an email magic link or Google.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setMessage(null);

            const formData = new FormData(event.currentTarget);
            const email = String(formData.get("email") ?? "").trim();

            startTransition(async () => {
              const supabase = createClient();
              const { error: otpError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: buildCallbackUrl(),
                },
              });

              if (otpError) {
                setError(otpError.message);
                return;
              }

              setMessage(
                isDev
                  ? "Check Mailpit for your sign-in link. Open the link in this same browser."
                  : "Check your email for a sign-in link. Open it in this same browser.",
              );
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending link…" : "Email me a sign-in link"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await signInWithGoogle(formData);
              if (result?.error) {
                setError(result.error);
              }
            });
          }}
        >
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Button type="submit" variant="outline" className="w-full" disabled={pending}>
            Continue with Google
          </Button>
        </form>

        {message ? (
          <p
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            role="status"
          >
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {isDev ? (
          <p className="text-xs text-muted-foreground">
            Local dev: magic links arrive in{" "}
            <a href={mailpitUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
              Mailpit
            </a>
            . Request the link and open it in this same browser.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
