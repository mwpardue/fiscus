"use client";

import { useState } from "react";
import { archiveRecurrenceRuleAction } from "../actions";

export function ArchiveRuleForm({
  openCount,
  planName,
  ruleId
}: {
  openCount: number;
  planName: string;
  ruleId: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const eventLabel = `${openCount} upcoming event${openCount === 1 ? "" : "s"}`;

  return (
    <div className="relative">
      <button
        className="inline-flex min-h-10 items-center justify-center rounded border border-danger/30 bg-white px-3 text-sm font-semibold text-danger"
        type="button"
        onClick={() => setIsConfirming(true)}
      >
        Archive rule
      </button>

      {isConfirming ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 grid w-72 gap-3 rounded border border-danger/30 bg-white p-3 text-sm shadow-lg sm:w-80"
          role="alertdialog"
          aria-label={`Archive rule for ${planName}`}
        >
          <div className="grid gap-1">
            <p className="font-semibold text-ink">Archive this rule?</p>
            <p className="leading-5 text-gray-700">
              {openCount > 0
                ? `This removes ${eventLabel} from active views. Completed history stays visible.`
                : "This stops the rule from generating future events."}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-paper px-3 text-sm font-semibold text-ink"
              type="button"
              onClick={() => setIsConfirming(false)}
            >
              Cancel
            </button>
            <form action={archiveRecurrenceRuleAction}>
              <input name="returnTo" type="hidden" value="/events/rules" />
              <input name="ruleId" type="hidden" value={ruleId} />
              <button className="inline-flex min-h-10 items-center justify-center rounded border border-danger/30 bg-danger px-3 text-sm font-semibold text-white">
                Archive
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
