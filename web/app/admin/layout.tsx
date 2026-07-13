"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const isConsole = pathname === "/admin";

  return (
    <div className="min-h-screen bg-linen/30">
      {!isLogin && !isConsole && (
        <div className="border-b border-sand/60 bg-white/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/admin"
              className="text-sm font-semibold text-cocoa hover:text-espresso"
            >
              &larr; Admin Console
            </Link>
            <Link href="/" className="text-sm text-muted hover:text-cocoa">
              Shop
            </Link>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
