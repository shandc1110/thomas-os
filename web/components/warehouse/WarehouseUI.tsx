"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/warehouse", label: "Warehouse", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/purchasing", label: "Purchasing" },
];

export function OpsNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto pb-2">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold ${
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

export function ScanInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Scan barcode…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder={placeholder}
        className="min-h-14 flex-1 rounded-2xl border-2 border-cocoa/30 bg-white px-4 text-lg outline-none focus:border-cocoa"
      />
      <button
        type="button"
        onClick={onSubmit}
        className="min-h-14 min-w-24 rounded-2xl bg-cocoa px-4 text-base font-bold text-cream"
      >
        Scan
      </button>
    </div>
  );
}

export function BigButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-cocoa text-cream"
      : variant === "danger"
        ? "bg-red-600 text-white"
        : "bg-linen text-espresso ring-2 ring-sand";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 w-full rounded-2xl px-6 text-base font-bold transition-opacity disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-linen text-muted",
    picking: "bg-amber-50 text-amber-800",
    picked: "bg-blue-50 text-blue-800",
    packing: "bg-purple-50 text-purple-800",
    packed: "bg-indigo-50 text-indigo-800",
    ready_to_ship: "bg-green-50 text-green-800",
    shipped: "bg-green-100 text-green-900",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${colors[status] ?? "bg-linen"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
