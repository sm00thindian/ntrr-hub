"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  connectHouseholdReliant,
  disconnectHouseholdReliant,
} from "@/lib/reliant/actions";
import { RELIANT_SMS_URL, RELIANT_URL } from "@/lib/reliant/bridge";

const APEX_URL = "https://ntrr.com";

type NtrrServicesCardProps = {
  /** Master ENV gate — when false, show cross-sell only (no connect control). */
  bridgeEnabled: boolean;
  coordinatorConnected: boolean;
  canManage: boolean;
};

/**
 * Cross-sell NTRR services inside Hub Settings.
 * Coordinator self-attest connects Reliant for phone confirm + SMS reminder options on tasks.
 */
export function NtrrServicesCard({
  bridgeEnabled,
  coordinatorConnected,
  canManage,
}: NtrrServicesCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>NTRR services</CardTitle>
        <CardDescription>
          Hub handles the runaround of managing it. Reliant handles the runaround of hoping it gets
          done. Phone confirms and SMS reminders on Hub tasks are powered by the{" "}
          <span className="font-medium text-foreground">coordinator&apos;s Reliant account</span>
          , even when the call or text goes to a caregiver or self-advocate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold tracking-tight">Reliant (coordinator account)</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              We don&apos;t stop until it&apos;s confirmed. The household coordinator should hold
              Reliant — that account places confirmation calls and SMS reminders and holds billing.
              Assignees only need a free Reliant account (and SMS opt-in for texts), not a paid plan.
            </p>
            {bridgeEnabled ? (
              <div className="mt-3 space-y-2">
                {coordinatorConnected ? (
                  <p className="text-foreground text-xs font-medium">
                    Reliant is marked connected for this household. Task forms can request phone
                    confirms and SMS reminders.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Connect Reliant here after you set up the coordinator account. Phone and SMS
                    services use the coordinator&apos;s Reliant subscription when billing is live
                    (dogfood is free while we measure volume).
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={RELIANT_URL}
                    className="text-brand inline-flex h-9 items-center text-sm font-medium hover:underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open Reliant →
                  </a>
                  {canManage ? (
                    coordinatorConnected ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setMessage(null);
                          startTransition(async () => {
                            const result = await disconnectHouseholdReliant();
                            if (result?.error) {
                              setError(result.error);
                              return;
                            }
                            setMessage("Reliant disconnected for this household.");
                            router.refresh();
                          });
                        }}
                      >
                        {pending ? "Updating…" : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setMessage(null);
                          startTransition(async () => {
                            const result = await connectHouseholdReliant();
                            if (result?.error) {
                              setError(result.error);
                              return;
                            }
                            setMessage("Reliant connected. Task forms can request confirms and SMS.");
                            router.refresh();
                          });
                        }}
                      >
                        {pending ? "Connecting…" : "I've set up Reliant"}
                      </Button>
                    )
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Ask an owner or admin to connect Reliant for the household.
                    </p>
                  )}
                </div>
                {message ? (
                  <p className="text-muted-foreground text-xs" role="status">
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p className="text-destructive text-xs" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3">
                <a
                  href={RELIANT_URL}
                  className="text-brand text-sm font-medium hover:underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open Reliant →
                </a>
              </p>
            )}
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Call/SMS targets: save a Hub mobile, then{" "}
              <a
                href={RELIANT_SMS_URL}
                className="text-brand font-medium hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                opt into Reliant SMS
              </a>{" "}
              with a free account when you want texts.
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold tracking-tight">Hub + Reliant bundle</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Planned: coordination and confirmation under one company — family board plus a shared
              pool of phone confirm and SMS reminder series on the coordinator&apos;s Reliant
              entitlement.
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Dogfood is free while we measure volume. Coordinators: set up Reliant. Members: save{" "}
              <span className="font-medium text-foreground">Your mobile number</span> so they can be
              reached.
            </p>
            <p className="mt-3">
              <a
                href={APEX_URL}
                className="text-brand text-sm font-medium hover:underline"
                rel="noopener noreferrer"
              >
                All NTRR services →
              </a>
            </p>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
