"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * When Supabase Site URL is the shop front, recovery emails land on `/`
 * with tokens in the hash. Forward those users to the admin reset page.
 */
export function RecoveryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.includes("type=recovery") && hash.includes("access_token")) {
      router.replace(`/admin/reset-password#${hash}`);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("code")) {
      const qs = new URLSearchParams(window.location.search);
      if (!qs.get("next")) qs.set("next", "/admin/reset-password");
      router.replace(`/auth/callback?${qs.toString()}`);
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/admin/reset-password");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
