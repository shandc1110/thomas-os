"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/thomas/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/admin/login" || pathname === "/admin/reset-password";
  const isConsole = pathname === "/admin";
  const showBack = !isAuthPage && !isConsole;

  if (isAuthPage) {
    return <>{children}</>;
  }

  return <AdminShell showBack={showBack}>{children}</AdminShell>;
}
