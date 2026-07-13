import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProductById } from "@/lib/inventory/products";
import { renderBarcodePng, ensureBarcode } from "@/lib/barcode/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "ean") as "ean" | "qr" | "code128";

  try {
    const supabase = getSupabaseAdmin();
    const { product, error } = await getProductById(supabase, id);
    if (error || !product) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const barcodeValue = ensureBarcode(product.sku ?? String(product.id), product.barcode);
    const png = await renderBarcodePng(barcodeValue, format);

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Barcode generation failed:", err);
    return NextResponse.json({ success: false, error: "Barcode generation failed." }, { status: 500 });
  }
}
