"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TaskDoneControlProps = {
  title: string;
  done: boolean;
  pending?: boolean;
  /** Compact for dense lists (My day, Needs attention) */
  size?: "sm" | "default";
  className?: string;
  onMarkDone: () => void;
  /** Optional reopen — care partners / self-advocates may undo a mis-tap */
  onReopen?: () => void;
};

/**
 * Clear complete / incomplete control for caregivers and self-advocates.
 * Incomplete: outline "Done". Complete: solid green "Done" (tap to reopen when allowed).
 */
export function TaskDoneControl({
  title,
  done,
  pending,
  size = "sm",
  className,
  onMarkDone,
  onReopen,
}: TaskDoneControlProps) {
  if (done) {
    const canReopen = Boolean(onReopen);
    return (
      <Button
        type="button"
        size={size}
        disabled={pending || !canReopen}
        aria-label={canReopen ? `Reopen ${title}` : `${title} is done`}
        title={canReopen ? "Tap to reopen" : "Completed"}
        className={cn(
          "shrink-0 border-transparent bg-brand text-brand-foreground hover:bg-brand/90",
          "disabled:opacity-100",
          !canReopen && "pointer-events-none",
          size === "sm" && "h-8 px-2.5",
          className,
        )}
        onClick={() => {
          if (onReopen) {
            onReopen();
          }
        }}
      >
        <Check className={cn("h-3.5 w-3.5", size === "default" && "h-4 w-4")} aria-hidden />
        Done
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      disabled={pending}
      aria-label={`Mark ${title} done`}
      className={cn("shrink-0", size === "sm" && "h-8 px-2.5", className)}
      onClick={onMarkDone}
    >
      <Check className={cn("h-3.5 w-3.5", size === "default" && "h-4 w-4")} aria-hidden />
      Done
    </Button>
  );
}
