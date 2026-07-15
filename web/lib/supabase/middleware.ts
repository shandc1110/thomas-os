import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicApiRoute } from "@/lib/thomas/auth/public-routes";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isResetPasswordPage = pathname === "/admin/reset-password";
  const isPublicAdminAuthPage = isLoginPage || isResetPasswordPage;
  const isApiRoute = pathname.startsWith("/api/");
  const isAdminRoute = pathname.startsWith("/admin");

  // Public API routes (e.g. customer checkout)
  if (isApiRoute && isPublicApiRoute(request.method, pathname)) {
    return supabaseResponse;
  }

  // Protected API routes — return 401 JSON (not redirect)
  if (isApiRoute && !user) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  // Admin pages — redirect to login (allow login + password reset without session)
  if (isAdminRoute && !user && !isPublicAdminAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    if (pathname !== "/admin") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // Logged-in users on login page → admin (do not bounce reset-password away)
  if (isAdminRoute && user && isLoginPage) {
    const next = request.nextUrl.searchParams.get("next") || "/admin";
    return NextResponse.redirect(new URL(next, request.url));
  }

  return supabaseResponse;
}
