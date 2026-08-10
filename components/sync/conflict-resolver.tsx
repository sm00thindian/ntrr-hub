"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveSyncConflict } from "@/lib/sync/actions";

export type ConflictView = {
  id: string;
  provider: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
  createdAt: string;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function ConflictResolver({ conflicts }: { conflicts: ConflictView[] }) {
  const [pending, startTransition] = useTransition();

  if (!conflicts.length) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No pending sync conflicts. Changes from Google and Hub are in sync.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-4">
      {conflicts.map((conflict) => (
        <li key={conflict.id}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {conflict.entityType.replace("_", " ")} · {conflict.fieldName}
              </CardTitle>
              <CardDescription>
                {conflict.provider} · detected {new Date(conflict.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Hub</p>
                  <p className="mt-1 text-sm">{formatValue(conflict.localValue)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Google</p>
                  <p className="mt-1 text-sm">{formatValue(conflict.remoteValue)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => void resolveSyncConflict(conflict.id, "keep_local"))
                  }
                >
                  Keep Hub
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => void resolveSyncConflict(conflict.id, "keep_remote"))
                  }
                >
                  Keep Google
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}