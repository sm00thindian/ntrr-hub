const SUPPORT_EMAIL = "support@ntrr.com";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={
        className ??
        "mt-auto border-t border-border/60 bg-transparent"
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="space-y-0.5">
          <p>
            A{" "}
            <a
              href="https://ntrr.com"
              className="underline-offset-2 hover:text-foreground hover:underline"
              rel="noopener noreferrer"
            >
              Not The Run Around
            </a>{" "}
            service
          </p>
          <p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            {" · "}
            <a
              href="https://reliant.ntrr.com"
              className="underline-offset-2 hover:text-foreground hover:underline"
              rel="noopener noreferrer"
            >
              Reliant
            </a>
          </p>
        </div>
        <p className="sm:text-right">© {new Date().getFullYear()} Not The Run Around</p>
      </div>
    </footer>
  );
}
