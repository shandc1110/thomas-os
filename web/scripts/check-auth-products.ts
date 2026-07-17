import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const client = createClient(url, anon);
  const email = `catalog-test-${Date.now()}@example.com`;
  const password = "CatalogTest123!";

  const signUp = await client.auth.signUp({ email, password });
  console.log("signUp error:", signUp.error?.message ?? "ok");

  const signIn = await client.auth.signInWithPassword({ email, password });
  console.log("signIn error:", signIn.error?.message ?? "ok");
  console.log("session:", Boolean(signIn.data.session));

  const authed = await client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  console.log("authenticated active count:", authed.count, authed.error?.message);

  await client.auth.signOut();

  const anonRes = await createClient(url, anon)
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  console.log("anon active count:", anonRes.count, anonRes.error?.message);
}

main().catch(console.error);
