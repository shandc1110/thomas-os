"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { THOMAS, getClientTenant } from "@/lib/thomas";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const resetError = searchParams.get("error") === "reset_link_invalid";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    resetError ? "That password reset link is invalid or expired. Request a new one below." : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const tenant = getClientTenant();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();

    if (forgotMode) {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/admin/reset-password")}`;
      const { error: resetErrorMsg } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetErrorMsg) {
        setError(resetErrorMsg.message);
        setLoading(false);
        return;
      }

      setInfo("Check your email for a password reset link. It expires after a short time.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-center text-sm text-clay hover:text-cocoa">
        &larr; Back to shop
      </Link>

      <div className="rounded-3xl bg-white p-8 ring-1 ring-sand/60">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">{THOMAS.name}</p>
        <h1 className="mt-2 font-serif text-3xl text-espresso">
          {forgotMode ? "Forgot password" : "Admin Login"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {forgotMode
            ? `We'll email a reset link for your ${tenant.name} admin account.`
            : `Sign in to ${tenant.name} on ${THOMAS.name}.`}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-espresso">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-sand px-4 py-3 text-base outline-none focus:border-cocoa"
              placeholder="you@chosenbychloe.com"
            />
          </label>

          {!forgotMode && (
            <label className="block">
              <span className="text-sm font-medium text-espresso">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-sand px-4 py-3 text-base outline-none focus:border-cocoa"
              />
            </label>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          {info && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cocoa py-3.5 text-base font-bold text-cream transition-opacity disabled:opacity-60"
          >
            {loading
              ? forgotMode
                ? "Sending…"
                : "Signing in…"
              : forgotMode
                ? "Send reset link"
                : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setForgotMode((v) => !v);
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm text-clay hover:text-cocoa"
        >
          {forgotMode ? "Back to sign in" : "Forgot password?"}
        </button>
      </div>
    </main>
  );
}
