import Link from "next/link";

export default function BrandNotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-espresso">Brand not found</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        That brand collection isn&apos;t available yet. Browse our active brands from the home page.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-espresso"
      >
        Back to brands
      </Link>
    </main>
  );
}
