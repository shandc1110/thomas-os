import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const workbook = XLSX.readFile("../CI+PL.xlsx");

const sheet = workbook.Sheets[workbook.SheetNames[0]];

const rows = XLSX.utils.sheet_to_json(sheet);

async function run() {
  for (const row of rows as any[]) {
    await supabase.from("products").upsert({
      sku: row["SKU"],
      name: row["Product Name"],
      stock: Number(row["Quantity"] ?? 0),
      active: true,
      brand: "Mideer",
    });
  }

  console.log("Finished");
}

run();