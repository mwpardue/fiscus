export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="border-b border-line pb-4">
          <div className="h-8 w-36 rounded bg-line" />
        </header>

        <section className="grid gap-3 rounded border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)]">
          <div className="grid gap-2">
            <div className="h-4 w-44 rounded bg-line" />
            <div className="h-12 rounded border border-line bg-paper" />
            <div className="h-10 w-32 rounded bg-line" />
          </div>
          <div className="rounded border border-line bg-paper p-4">
            <div className="h-4 w-28 rounded bg-line" />
            <div className="mt-3 h-8 w-36 rounded bg-line" />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 rounded border border-line bg-white p-4">
          <div className="grid gap-2">
            <div className="h-4 w-32 rounded bg-line" />
            <div className="h-7 w-24 rounded bg-line" />
          </div>
          <div className="grid gap-2">
            <div className="h-4 w-32 rounded bg-line" />
            <div className="h-7 w-24 rounded bg-line" />
          </div>
        </section>

        <section className="grid gap-3 rounded border border-line bg-white p-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div className="h-10 w-10 rounded border border-line bg-paper" />
            <div className="mx-auto h-6 w-40 rounded bg-line" />
            <div className="h-10 w-10 rounded border border-line bg-paper" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => (
              <div
                className="min-h-14 rounded border border-line bg-paper p-2"
                key={index}
              >
                <div className="h-5 w-5 rounded-full bg-line" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
