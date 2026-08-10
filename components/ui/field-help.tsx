import { cn } from "@/lib/utils";

type FieldHelpProps = {
  /** Visible label text */
  label: string;
  /** Longer explanation shown on hover / focus */
  help: string;
  htmlFor?: string;
  className?: string;
};

/**
 * Label + info control with a CSS hover/focus tooltip (no extra dependencies).
 * Uses title= as a progressive-enhancement fallback for long-press / AT.
 */
export function FieldHelp({ label, help, htmlFor, className }: FieldHelpProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      ) : (
        <span className="text-sm font-medium leading-none">{label}</span>
      )}
      <span className="group relative inline-flex">
        <button
          type="button"
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
            "border border-border bg-muted text-[11px] font-semibold text-muted-foreground",
            "hover:border-foreground/30 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
          aria-label={help}
          title={help}
        >
          ?
        </button>
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2",
            "rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-normal leading-relaxed text-foreground shadow-md",
            "opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          {help}
        </span>
      </span>
    </span>
  );
}

/** Compact help for stacked micro-labels (member list) */
export function MicroFieldHelp({
  label,
  help,
  className,
}: {
  label: string;
  help: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{label}</span>
      <span className="group relative inline-flex">
        <button
          type="button"
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
            "border border-border/80 bg-background text-[9px] font-semibold text-muted-foreground",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={help}
          title={help}
        >
          ?
        </button>
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute right-0 top-full z-50 mt-1.5 w-56",
            "rounded-lg border border-border bg-card px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed text-foreground shadow-md",
            "opacity-0 transition-opacity sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
            "group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          {help}
        </span>
      </span>
    </span>
  );
}
