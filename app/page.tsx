import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const highlights = [
  {
    title: "Cross-ecosystem calendars",
    body: "Google, Apple, and shared family views without ripping out what already works.",
  },
  {
    title: "Shared task board",
    body: "Roles, handoffs, and recurring care work in one place everyone can trust.",
  },
  {
    title: "Proactive highlights",
    body: "Conflicts and reminders surface early — calm orchestration, not more noise.",
  },
  {
    title: "Provenance built in",
    body: "Know where every item came from. Never silent merges of conflicting data.",
  },
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" size="md" />
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 sm:pt-14">
        <div className="space-y-4">
          <p className="text-sm font-medium tracking-wide text-brand">
            Family Care Orchestrator
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            One calm dashboard for family care coordination
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
            Unify calendars, tasks, and family handoffs across the tools you already use — built
            for Gen X caregivers who need reliability, not another app to babysit.
          </p>
        </div>

        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/login">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {highlights.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
            >
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
