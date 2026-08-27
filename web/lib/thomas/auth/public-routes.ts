/** API routes that do not require staff authentication. */
const PUBLIC_API_ROUTES: { method: string; path: string }[] = [
  { method: "GET", path: "/api/catalog" },
  { method: "POST", path: "/api/orders" },
  { method: "POST", path: "/api/stripe/webhook" },
  { method: "GET", path: "/api/stripe/session" },
  // Joybuy callback — public but does not grant admin access or store secrets.
  { method: "GET", path: "/api/integrations/joybuy/callback" },
  { method: "POST", path: "/api/integrations/joybuy/callback" },
];

export function isPublicApiRoute(method: string, pathname: string): boolean {
  const normalised = pathname.split("?")[0];
  return PUBLIC_API_ROUTES.some(
    (route) => route.method === method.toUpperCase() && route.path === normalised,
  );
}
