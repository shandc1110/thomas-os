"use client";

import { ModuleNav } from "@/components/thomas/ModuleNav";

const NAV_ITEMS = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/warehouse", label: "Warehouse" },
  { href: "/admin/purchasing", label: "Purchasing" },
  { href: "/admin/inventory", label: "Dashboard", exact: true },
  { href: "/admin/inventory/products", label: "Products" },
  { href: "/admin/inventory/pricing", label: "Pricing" },
  { href: "/admin/inventory/warehouse", label: "Warehouses" },
  { href: "/admin/inventory/receive", label: "Receive" },
  { href: "/admin/inventory/stock-take", label: "Stock Take" },
];

export function AdminNav() {
  return <ModuleNav items={NAV_ITEMS} />;
}
