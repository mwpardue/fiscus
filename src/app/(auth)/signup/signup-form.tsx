"use client";

import { useActionState } from "react";
import { signupAction, type SignupActionState } from "./actions";

const initialState: SignupActionState = {
  status: "idle"
};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-ink">
        Email
        <input
          className="min-h-12 rounded border border-line bg-white px-3 text-base"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-ink">
        Password
        <input
          className="min-h-12 rounded border border-line bg-white px-3 text-base"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-ink">
        Confirm password
        <input
          className="min-h-12 rounded border border-line bg-white px-3 text-base"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Currency
          <input
            className="min-h-12 rounded border border-line bg-white px-3 text-base uppercase"
            name="defaultCurrencyCode"
            defaultValue="USD"
            maxLength={3}
            minLength={3}
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Timezone
          <input
            className="min-h-12 rounded border border-line bg-white px-3 text-base"
            name="timezone"
            defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
            required
          />
        </label>
      </div>

      <button
        className="min-h-12 rounded bg-mint px-4 font-semibold text-white disabled:opacity-60"
        disabled={pending}
      >
        Create account
      </button>

      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "rounded border border-danger/30 bg-white px-3 py-2 text-sm text-danger"
              : "rounded border border-mint/30 bg-white px-3 py-2 text-sm text-mint"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
