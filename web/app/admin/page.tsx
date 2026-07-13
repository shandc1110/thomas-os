"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MODULES = [
  {
    href: "/admin/orders",
    title: "Orders Management",
    description: "View orders, packing slips, and Shopify fulfilment.",
    icon: "📦",
  },
  {
    href: "/admin/warehouse",
    title: "Warehouse",
    description: "Pick, pack, verify, and dispatch customer orders.",
    icon: "🏭",
  },
  {
    href: "/admin/purchasing",
    title: "Purchasing",
    description: "Suppliers, purchase orders, and inbound shipments.",
    icon: "🛒",
  },
  {
    href: "/admin/inventory",
    title: "Stock Management",
    description: "Products, warehouses, goods receipt, and stock take.",
    icon: "📊",
  },
];

export default function AdminConsolePage() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 pb-16">
      <header className="mb-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Chosen by Chloe OS</p>
        <h1 className="mt-2 font-serif text-4xl text-espresso">Admin Console</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Manage orders, warehouse operations, purchasing, and inventory from one place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group flex flex-col rounded-3xl bg-white p-6 ring-1 ring-sand/60 transition hover:ring-cocoa/40 hover:shadow-md"
          >
            <span className="text-3xl" aria-hidden>
              {mod.icon}
            </span>
            <h2 className="mt-4 font-serif text-xl text-espresso group-hover:text-cocoa">
              {mod.title}
            </h2>
            <p className="mt-2 flex-1 text-sm text-muted">{mod.description}</p>
            <span className="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl bg-cocoa px-6 text-sm font-bold text-cream">
              Open
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/" className="text-sm font-medium text-clay hover:text-cocoa">
          &larr; Back to shop
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="rounded-full bg-linen px-5 py-2 text-sm font-semibold text-espresso ring-1 ring-sand hover:bg-sand/40"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
