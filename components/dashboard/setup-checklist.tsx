import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HouseholdSetupStatus } from "@/lib/households/setup";
import { cn } from "@/lib/utils";

export function SetupChecklist({ status }: { status: HouseholdSetupStatus }) {
  if (status.complete) {
    return null;
  }

  return (
    <Card className="border-brand/25 bg-brand/5">
      <CardHeader>
        <CardTitle className="text-lg">Get your household ready</CardTitle>
        <CardDescription>
          {status.completedCount} of {status.totalCount} done — a few minutes to a useful board.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {status.steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                step.done && "opacity-70",
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.done
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{step.description}</p>
                </div>
              </div>
              {!step.done ? (
                <Button asChild size="sm" variant="outline" className="shrink-0 sm:ml-3">
                  <Link href={step.href}>Continue</Link>
                </Button>
              ) : (
                <span className="text-muted-foreground shrink-0 text-xs sm:ml-3">Done</span>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
