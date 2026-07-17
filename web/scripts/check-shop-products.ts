import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const anonClient = createClient(url, anon);
  const svcClient = createClient(url, svc);

  const anonRes = await anonClient
    .from("products")
    .select("id, sku, active, price, presell_enabled, presell_quantity")
    .eq("active", true)
    .limit(5);

  const svcRes = await svcClient
    .from("products")
    .select("id, sku, active, price, presell_enabled, presell_quantity")
    .eq("active", true)
    .limit(5);

  const svcAll = await svcClient.from("products").select("id", { count: "exact", head: true });
  const svcActive = await svcClient
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const svcInactive = await svcClient
    .from("products")
    .select("sku, active, price, stock, presell_enabled, presell_quantity, image_url")
    .eq("sku", "CT2216")
    .maybeSingle();

  const { data: allActive } = await svcClient
    .from("products")
    .select("sku, stock, presell_enabled, presell_quantity, price, active")
    .eq("active", true);

  let sellableCount = 0;
  let noPriceCount = 0;
  for (const p of allActive ?? []) {
    const onHand = Math.max((p.stock as number) ?? 0, 0);
    const presell = p.presell_enabled ? Math.max((p.presell_quantity as number) ?? 0, 0) : 0;
    if (onHand + presell > 0) sellableCount++;
    if (!p.price || Number(p.price) <= 0) noPriceCount++;
  }

  console.log("ANON active products:", anonRes.data?.length ?? 0, anonRes.error?.message ?? "ok");
  console.log("SVC active products:", svcRes.data?.length ?? 0, svcRes.error?.message ?? "ok");
  console.log("Total products (svc):", svcAll.count);
  console.log("Active products (svc):", svcActive.count);
  console.log("Active with sellable stock:", sellableCount);
  console.log("Active with no/zero price:", noPriceCount);
  console.log("CT2216 row:", svcInactive.data, svcInactive.error?.message);
}

main().catch(console.error);
