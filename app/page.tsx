import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/supabase/auth";

const highlights = [
  {
    title: "Cross-ecosystem calendars",
    body: "Google, Apple, and shared family views without ripping out what already works.",
  },
  {
    title: "Shared task board",
    body: "Roles, handoffs, and recurring care work in one place — one less “who has this?”",
  },
  {
    title: "Proactive highlights",
    body: "Conflicts and reminders surface early — calm orchestration, not more noise.",
  },
  {
    title: "Clear source for every item",
    body: "See where each task or event came from. When details disagree, you choose what to keep.",
  },
] as const;

export default async function HomePage() {
  // Do not throw when Supabase is down (common in local dev before `npm run db:start`).
  const user = await getOptionalUser();

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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-12 pt-8 sm:px-6 sm:pt-14 sm:pb-16">
        {/* Hero — brand lives in the header logo; lead with the product promise */}
        <div className="space-y-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            One less thing to manage
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            Shared calendars, tasks, and family handoffs across the tools you already use — so you
            shouldn&apos;t have to think about coordination for it to work.
          </p>
        </div>

        {/* Primary CTA hierarchy + micro-trust */}
        <div className="mt-8 space-y-3 sm:mt-9">
          <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Button asChild size="lg" className="w-full shadow-sm sm:w-auto sm:min-w-[10.5rem]">
              <Link href="/login">Get started</Link>
            </Button>
            <Link
              href="/login"
              className="px-1 text-center text-sm text-muted-foreground/80 underline-offset-4 transition-colors hover:text-muted-foreground hover:underline sm:text-left"
            >
              Sign in
            </Link>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground/70 sm:text-[0.8125rem]">
            Works with the calendars and apps you already use — no need to abandon them.
          </p>
        </div>

        {/* Feature cards — extra separation from hero on mobile */}
        <ul className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-4">
          {highlights.map((item) => (
            <li
              key={item.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-sm font-semibold tracking-tight text-foreground">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter className="mt-auto border-t border-border/60 bg-transparent pt-2" />
    </div>
  );
}
