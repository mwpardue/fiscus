import { LoginForm } from "./login-form";
import type { Route } from "next";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <section className="mx-auto grid w-full max-w-md gap-6">
        <div className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-mint">
            fiscus
          </p>
          <h1 className="text-3xl font-semibold text-ink">Sign in</h1>
          <p className="text-sm leading-6 text-gray-700">
            Use your password or request a magic link for this private billing
            workspace.
          </p>
        </div>
        <div className="rounded border border-line bg-white p-4 shadow-sm sm:p-6">
          <LoginForm />
        </div>
        <p className="text-center text-sm text-gray-700">
          Need an account?{" "}
          <Link
            className="font-semibold text-mint underline-offset-4 hover:underline"
            href={"/signup" as Route}
          >
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
