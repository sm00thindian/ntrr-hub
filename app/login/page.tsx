import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/layout/site-footer";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error, message } = await searchParams;

  const initialError =
    error === "auth"
      ? message ??
        "Sign-in link failed. Request a fresh link and open it in the same browser you used to sign in."
      : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" size="md" />
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <LoginForm next={next} initialError={initialError} />
      </main>

      <SiteFooter />
    </div>
  );
}
