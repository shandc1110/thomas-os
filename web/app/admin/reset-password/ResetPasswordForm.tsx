"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { THOMAS, getClientTenant } from "@/lib/thomas";

export default function ResetPasswordForm() {
  const router = useRouter();
  const tenant = getClientTenant();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function prepare() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setReady(true);
        setChecking(false);
        return;
      }

      // Hash tokens from recovery email (implicit / older flow)
      const hash = window.location.hash.replace(/^#/, "");
      if (hash.includes("access_token") && hash.includes("type=recovery")) {
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: setErrorSession } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!setErrorSession) {
            window.history.replaceState(null, "", window.location.pathname);
            setReady(true);
            setChecking(false);
            return;
          }
        }
      }

      setError("This reset link is invalid or has expired. Request a new one from the login page.");
      setChecking(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
        setError(null);
      }
    });

    prepare();
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      router.push("/admin");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <Link href="/admin/login" className="mb-8 text-center text-sm text-clay hover:text-cocoa">
        &larr; Back to login
      </Link>

      <div className="rounded-3xl bg-white p-8 ring-1 ring-sand/60">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">{THOMAS.name}</p>
        <h1 className="mt-2 font-serif text-3xl text-espresso">Reset password</h1>
        <p className="mt-2 text-sm text-muted">Choose a new password for {tenant.name} admin.</p>

        {checking && <p className="mt-8 text-sm text-muted">Verifying reset link…</p>}

        {!checking && error && !ready && (
          <div className="mt-8 space-y-4">
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
            <Link
              href="/admin/login"
              className="block w-full rounded-2xl bg-cocoa py-3.5 text-center text-base font-bold text-cream"
            >
              Go to login
            </Link>
          </div>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-espresso">New password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-sand px-4 py-3 text-base outline-none focus:border-cocoa"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-espresso">Confirm password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-sand px-4 py-3 text-base outline-none focus:border-cocoa"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-cocoa py-3.5 text-base font-bold text-cream transition-opacity disabled:opacity-60"
            >
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}

        {success && (
          <p className="mt-8 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
            Password updated. Redirecting to admin…
          </p>
        )}
      </div>
    </main>
  );
}
