"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {
  status: "idle"
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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
          autoComplete="current-password"
          minLength={8}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          className="min-h-12 rounded bg-mint px-4 font-semibold text-white disabled:opacity-60"
          name="intent"
          value="password"
          disabled={pending}
        >
          Sign in
        </button>
        <button
          className="min-h-12 rounded border border-mint px-4 font-semibold text-mint disabled:opacity-60"
          name="intent"
          value="magic-link"
          disabled={pending}
        >
          Email link
        </button>
      </div>

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
