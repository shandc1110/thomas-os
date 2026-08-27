import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { completeStripeCheckoutSession } from "@/lib/stripe/complete-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirm payment after redirect (idempotent backup if webhook is delayed). */
export async function GET(request: Request): Promise<NextResponse> {
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "Missing session_id." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { success: false, error: "Ordering is not configured." },
      { status: 500 },
    );
  }

  const result = await completeStripeCheckoutSession(supabase, sessionId);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Payment not confirmed." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    order_number: result.orderNumber,
    already_paid: result.alreadyPaid ?? false,
  });
}
