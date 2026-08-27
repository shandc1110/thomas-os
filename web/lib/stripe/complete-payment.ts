import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { getOrderById } from "@/lib/orders";
import { getStripe } from "./client";

/** Mark order paid from a completed Stripe Checkout session (idempotent). */
export async function completeStripeCheckoutSession(
  supabase: SupabaseClient,
  sessionId: string,
  organizationId?: string,
): Promise<{ success: boolean; orderNumber?: string; alreadyPaid?: boolean; error?: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return { success: false, error: "Payment not completed." };
  }

  const orderId = session.metadata?.order_id;
  const orderNumber = session.metadata?.order_number;
  if (!orderId) {
    return { success: false, error: "Missing order reference on Stripe session." };
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("id, order_number, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Order not found." };
  }

  const resolvedNumber = orderNumber ?? (existing.order_number as string);
  if (existing.payment_status === "paid") {
    return { success: true, orderNumber: resolvedNumber, alreadyPaid: true };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", orderId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { order } = await getOrderById(supabase, String(orderId), organizationId);
  if (order?.email) {
    await sendOrderConfirmationEmail({
      orderNumber: resolvedNumber,
      customer: {
        first_name: order.first_name ?? order.customer_name.split(" ")[0] ?? "",
        last_name:
          order.last_name ?? order.customer_name.split(" ").slice(1).join(" ") ?? "",
        wechat_name: order.wechat_name,
        phone: order.phone,
        email: order.email,
        address: order.address ?? "",
        postcode: order.postcode ?? "",
        payment_method: order.payment_method ?? "Pay by card (Stripe)",
        currency: order.currency ?? "GBP",
        notes: order.notes ?? undefined,
      },
      items: order.items.map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.total,
    });
  }

  return { success: true, orderNumber: resolvedNumber };
}
