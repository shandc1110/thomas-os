import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">Product not found</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        This product isn&apos;t available right now. Browse our brands or return to the home page.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/brands"
          className="inline-flex min-h-10 items-center border border-sand px-4 text-sm font-medium text-charcoal transition hover:border-sage"
        >
          Browse brands
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-semibold text-ivory transition hover:bg-charcoal/90"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
