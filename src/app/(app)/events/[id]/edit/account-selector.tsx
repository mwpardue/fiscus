"use client";

import { useState } from "react";

export function EventAccountSelector({
  accounts,
  defaultAccountId
}: {
  accounts: Array<{ id: string; name: string }>;
  defaultAccountId?: string | null;
}) {
  const hasDefaultAccount =
    !!defaultAccountId &&
    accounts.some((account) => account.id === defaultAccountId);
  const [accountMode, setAccountMode] = useState<"none" | "existing" | "new">(
    hasDefaultAccount ? "existing" : "none"
  );
  const [selectedAccountId, setSelectedAccountId] = useState(
    hasDefaultAccount ? defaultAccountId : ""
  );

  return (
    <>
      <div className="grid min-w-0 gap-2 text-sm font-medium text-ink">
        <label htmlFor="edit-event-account">Account</label>
        <select
          id="edit-event-account"
          name="accountChoice"
          className="min-h-12 rounded border border-line bg-white px-3 text-base"
          value={
            accountMode === "existing"
              ? selectedAccountId
              : accountMode === "new"
                ? "__new__"
                : ""
          }
          onChange={(event) => {
            if (event.target.value === "__new__") {
              setAccountMode("new");
              return;
            }

            if (event.target.value === "") {
              setAccountMode("none");
              setSelectedAccountId("");
              return;
            }

            setAccountMode("existing");
            setSelectedAccountId(event.target.value);
          }}
        >
          <option value="">No account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
          <option value="__new__">New account...</option>
        </select>
      </div>

      <input name="accountMode" type="hidden" value={accountMode} />
      {accountMode === "existing" ? (
        <input name="counterpartyId" type="hidden" value={selectedAccountId} />
      ) : null}

      {accountMode === "new" ? (
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            New account name
            <input
              className="min-h-12 rounded border border-line bg-white px-3 text-base"
              name="counterpartyName"
              placeholder="Merchant, biller, payer, employer"
              required
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            Account icon
            <input
              accept="image/png,image/jpeg,image/webp"
              className="min-h-12 w-full min-w-0 rounded border border-line bg-white px-3 py-2 text-sm"
              name="accountIcon"
              type="file"
            />
          </label>
        </div>
      ) : null}
    </>
  );
}
