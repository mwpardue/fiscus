import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <section className="mx-auto grid w-full max-w-md gap-6">
        <div className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-mint">
            fiscus
          </p>
          <h1 className="text-3xl font-semibold text-ink">Create account</h1>
          <p className="text-sm leading-6 text-gray-700">
            Set up your private workspace with Supabase Auth and a user profile
            row for app defaults.
          </p>
        </div>
        <div className="rounded border border-line bg-white p-4 shadow-sm sm:p-6">
          <SignupForm />
        </div>
        <p className="text-center text-sm text-gray-700">
          Already have an account?{" "}
          <Link className="font-semibold text-mint underline-offset-4 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
