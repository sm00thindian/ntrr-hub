import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RELIANT_URL = "https://reliant.ntrr.com";
const APEX_URL = "https://ntrr.com";

/**
 * Cross-sell NTRR services inside Hub Settings.
 * Reliant phone confirm is positioned as optional tiered add-on / bundle later.
 */
export function NtrrServicesCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>NTRR services</CardTitle>
        <CardDescription>
          Hub is the family board. Reliant is phone-first accountability. Hub confirms are powered by
          the <span className="font-medium text-foreground">coordinator&apos;s Reliant account</span>
          , even when the call goes to a caregiver or self-advocate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold tracking-tight">Reliant (coordinator account)</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              The household coordinator should hold Reliant. That account places confirmation calls
              and holds billing — it can dial a care partner or self-advocate&apos;s number for
              completion checks.
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Mark tasks with{" "}
              <span className="font-medium text-foreground">Request Reliant phone confirmation</span>
              . Live dials need the coordinator on Reliant plus mobiles on call targets.
            </p>
            <p className="mt-3">
              <a
                href={RELIANT_URL}
                className="text-brand text-sm font-medium hover:underline"
                rel="noopener noreferrer"
              >
                Open Reliant →
              </a>
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold tracking-tight">Hub + Reliant bundle</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Planned: family coordination plus a shared pool of phone confirm series on the
              coordinator&apos;s Reliant entitlement — clearer than two unrelated tools.
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Dogfood is free while we measure volume. Coordinators: set up Reliant. Members: save{" "}
              <span className="font-medium text-foreground">Your mobile number</span> so they can be
              reached for confirms.
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
