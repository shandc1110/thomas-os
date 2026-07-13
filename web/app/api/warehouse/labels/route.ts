import { NextResponse } from "next/server";
import { renderWarehouseLabel } from "@/lib/barcode/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "product") as "product" | "shelf" | "location";
  const value = searchParams.get("value");
  const format = (searchParams.get("format") ?? "code128") as "ean" | "code128" | "qr";

  if (!value) {
    return NextResponse.json({ success: false, error: "value required." }, { status: 400 });
  }

  try {
    const png = await renderWarehouseLabel(type, value, format);
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Label generation failed." }, { status: 500 });
  }
}
