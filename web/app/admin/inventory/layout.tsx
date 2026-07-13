import Link from "next/link";
import { AdminNav } from "@/components/inventory/AdminNav";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between pt-8 pb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Chosen by Chloe OS</p>
          <h1 className="font-serif text-2xl text-espresso">Inventory</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-clay hover:text-cocoa">
          Shop &rarr;
        </Link>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
