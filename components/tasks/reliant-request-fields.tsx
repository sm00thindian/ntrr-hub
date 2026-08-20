import Link from "next/link";

import { RELIANT_SMS_URL, RELIANT_URL, type ReliantBridgeState } from "@/lib/reliant/constants";

export type ReliantRequestFieldsProps = {
  bridge: ReliantBridgeState;
  defaultConfirm?: boolean;
  defaultSms?: boolean;
  /** Slightly shorter helper copy for edit / recurring */
  compact?: boolean;
};

/**
 * Gated Reliant phone + SMS request options for task / template forms.
 * ENV off → greyed preview. Connected → checkboxes. Else → connect CTA.
 */
export function ReliantRequestFields({
  bridge,
  defaultConfirm = false,
  defaultSms = false,
  compact = false,
}: ReliantRequestFieldsProps) {
  if (!bridge.enabled) {
    return (
      <div className="sm:col-span-2 space-y-3 opacity-60">
        <p className="text-muted-foreground text-xs leading-relaxed px-0.5">
          Reliant phone confirms and SMS reminders will unlock here once Hub ↔ Reliant integration is
          ready.
        </p>
        <label className="border-border bg-muted/30 flex cursor-not-allowed items-start gap-3 rounded-lg border px-3 py-3 text-sm">
          <input
            type="checkbox"
            disabled
            aria-disabled="true"
            className="border-input mt-0.5 size-4 shrink-0 rounded opacity-50"
          />
          <span>
            <span className="text-foreground font-medium">Request Reliant phone confirmation</span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
              {compact
                ? "Coordinator’s Reliant account may call the assignee until they confirm."
                : "Uses the household coordinator’s Reliant account (billing). Reliant calls the assignee or self-advocate’s mobile until they confirm — they do not need their own Reliant subscription."}
            </span>
          </span>
        </label>

        <label className="border-border bg-muted/30 flex cursor-not-allowed items-start gap-3 rounded-lg border px-3 py-3 text-sm">
          <input
            type="checkbox"
            disabled
            aria-disabled="true"
            className="border-input mt-0.5 size-4 shrink-0 rounded opacity-50"
          />
          <span>
            <span className="text-foreground font-medium">Request Reliant SMS reminder</span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
              Soft text nudge when due (or due soon) via the coordinator’s Reliant account — not a
              phone call.
            </span>
          </span>
        </label>
      </div>
    );
  }

  if (!bridge.coordinatorConnected) {
    return (
      <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm">
        <p className="font-medium text-foreground">Reliant phone &amp; SMS</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          The household coordinator connects Reliant (subscription account when billing is live) to
          request phone confirms or SMS reminders on tasks.{" "}
          <Link href="/settings" className="text-brand font-medium hover:underline">
            Open Settings
          </Link>{" "}
          or{" "}
          <a
            href={RELIANT_URL}
            className="text-brand font-medium hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            set up Reliant
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      <label className="border-border bg-muted/30 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm">
        <input
          type="checkbox"
          name="reliantConfirmRequested"
          value="true"
          defaultChecked={defaultConfirm}
          className="border-input mt-0.5 size-4 shrink-0 rounded"
        />
        <span>
          <span className="text-foreground font-medium">Request Reliant phone confirmation</span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {compact
              ? "Coordinator’s Reliant account may call the assignee until they confirm."
              : "Uses the household coordinator’s Reliant account (billing). Reliant calls the assignee or self-advocate’s mobile until they confirm — they do not need their own Reliant subscription."}
          </span>
        </span>
      </label>

      <label className="border-border bg-muted/30 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm">
        <input
          type="checkbox"
          name="reliantSmsReminderRequested"
          value="true"
          defaultChecked={defaultSms}
          className="border-input mt-0.5 size-4 shrink-0 rounded"
        />
        <span>
          <span className="text-foreground font-medium">Request Reliant SMS reminder</span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            Soft text nudge when due (or due soon) via the coordinator’s Reliant account — not a
            phone call. Live texts go only to mobiles that opted into Reliant SMS.
          </span>
        </span>
      </label>

      <p className="text-muted-foreground text-xs leading-relaxed px-0.5">
        Assignees and self-advocates need a free Reliant account and SMS opt-in for texts — no paid
        plan required.{" "}
        <a
          href={RELIANT_SMS_URL}
          className="text-brand font-medium hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Opt in at Reliant
        </a>
        . Save a Hub mobile on Family or Settings so Reliant knows who to reach.
      </p>
    </div>
  );
}
