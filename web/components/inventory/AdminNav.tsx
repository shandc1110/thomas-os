"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/warehouse", label: "Warehouse" },
  { href: "/admin/purchasing", label: "Purchasing" },
  { href: "/admin/inventory", label: "Dashboard", exact: true },
  { href: "/admin/inventory/products", label: "Products" },
  { href: "/admin/inventory/warehouse", label: "Warehouses" },
  { href: "/admin/inventory/receive", label: "Receive" },
  { href: "/admin/inventory/stock-take", label: "Stock Take" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-sand/60 pb-4">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-cocoa text-cream"
                : "bg-linen text-espresso ring-1 ring-sand hover:bg-sand/40"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
