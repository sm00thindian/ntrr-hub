import type { ProvenanceSource } from "@/lib/provenance/types";
import { cn } from "@/lib/utils";

const LABELS: Record<ProvenanceSource, string> = {
  ntrr: "ntrr",
  google: "Google",
  microsoft: "Microsoft",
  apple_caldav: "Apple",
  zapier: "Zapier",
};

export function SourceChip({
  source,
  className,
}: {
  source: ProvenanceSource;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        source === "ntrr" && "bg-brand text-brand-foreground",
        source === "google" && "bg-muted text-muted-foreground",
        source !== "ntrr" && source !== "google" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {LABELS[source]}
    </span>
  );
}