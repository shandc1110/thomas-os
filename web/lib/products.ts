import { createClient } from "@supabase/supabase-js";
import type { Product } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type ProductsResult = {
  products: Product[];
  error: string | null;
};

export async function getActiveProducts(): Promise<ProductsResult> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return { products: [], error: error.message };
  }

  return { products: (data as Product[]) ?? [], error: null };
}
