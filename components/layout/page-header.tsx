import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /**
   * Short purpose line for the page (what this view is for).
   * Household / place context lives in app chrome — do not put it here.
   */
  description?: string;
  /**
   * Live status chips or short counts (e.g. "1 done · 2 left").
   * Joined after description with a middle dot when both are present.
   */
  status?: React.ReactNode;
  /** Secondary meta (timezone, date range). */
  meta?: string;
  /** Emphasize status (e.g. progress counts on My day). */
  statusAccent?: boolean;
  /**
   * When true, hide the purpose text below `sm` so mobile stays scannable.
   * Status and meta still show.
   */
  hideDescriptionOnMobile?: boolean;
  /** Optional trailing controls (calendar prev/next, etc.). */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Shared page title block for Hub app routes.
 *
 * Contract: H1 = mode/page name; subline = purpose · status · meta.
 * Place (household name) is chrome-only — sidebar + sticky header.
 */
export function PageHeader({
  title,
  description,
  status,
  meta,
  statusAccent = false,
  hideDescriptionOnMobile = false,
  actions,
  className,
}: PageHeaderProps) {
  const hasSubline = Boolean(description || status || meta);

  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {hasSubline ? (
          <p className="text-muted-foreground mt-0.5 text-sm">
            {description ? (
              <span
                className={cn(hideDescriptionOnMobile && "hidden sm:inline")}
              >
                {description}
              </span>
            ) : null}
            {description && (status || meta) ? (
              <span
                className={cn(
                  hideDescriptionOnMobile && "hidden sm:inline",
                )}
                aria-hidden
              >
                {" · "}
              </span>
            ) : null}
            {status ? (
              <span className={cn(statusAccent && "text-brand")}>{status}</span>
            ) : null}
            {status && meta ? (
              <span aria-hidden>{" · "}</span>
            ) : null}
            {meta ? (
              <span className="text-muted-foreground/80">{meta}</span>
            ) : null}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div> : null}
    </div>
  );
}
