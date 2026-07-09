import Link from "next/link";

export default function SignupUnavailablePage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <section className="mx-auto grid w-full max-w-md gap-6">
        <div className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-mint">
            fiscus
          </p>
          <h1 className="text-3xl font-semibold text-ink">
            New users are closed
          </h1>
          <p className="text-sm leading-6 text-gray-700">
            Sorry, we are not taking new users at this time.
          </p>
        </div>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded bg-mint px-4 font-semibold text-white"
          href="/login"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
