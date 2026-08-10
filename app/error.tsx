"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Hub] app error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-start justify-center gap-4 px-4 py-16">
      <p className="text-brand text-sm font-medium">Something went wrong</p>
      <h1 className="text-2xl font-semibold tracking-tight">Hub hit an unexpected error</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Try again. If it keeps happening, sign out and back in, or hard-refresh to clear a stale
        app cache (especially if you installed Hub as a PWA).
      </p>
      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Digest: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
        <Button type="button" variant="ghost" onClick={() => (window.location.href = "/login")}>
          Sign in
        </Button>
      </div>
    </div>
  );
}
