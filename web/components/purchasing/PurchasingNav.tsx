"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/purchasing", label: "Dashboard", exact: true },
  { href: "/admin/purchasing/suppliers", label: "Suppliers" },
  { href: "/admin/purchasing/brands", label: "Brands" },
  { href: "/admin/purchasing/purchase-orders", label: "Purchase Orders" },
  { href: "/admin/purchasing/shipments", label: "Shipments" },
];

export function PurchasingNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-sand/60 pb-4">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              active ? "bg-cocoa text-cream" : "bg-linen text-espresso ring-1 ring-sand"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
