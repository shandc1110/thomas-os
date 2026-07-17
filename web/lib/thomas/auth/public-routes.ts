/** API routes that do not require staff authentication. */
const PUBLIC_API_ROUTES: { method: string; path: string }[] = [
  { method: "GET", path: "/api/catalog" },
  { method: "POST", path: "/api/orders" },
];

export function isPublicApiRoute(method: string, pathname: string): boolean {
  const normalised = pathname.split("?")[0];
  return PUBLIC_API_ROUTES.some(
    (route) => route.method === method.toUpperCase() && route.path === normalised,
  );
}
