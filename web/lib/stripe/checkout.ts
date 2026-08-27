import "server-only";
import { convertCnyToGbp, normaliseCurrency } from "@/lib/currency";
import { getSiteUrl, getStripe } from "./client";

export type StripeCheckoutLine = {
  name: string;
  quantity: number;
  unitAmountGbp: number;
};

/** Stripe UK account — card payments are always taken in GBP. */
export function amountGbpForStripe(
  unitPrice: number,
  currency: string | null | undefined,
): number {
  const code = normaliseCurrency(currency);
  return code === "GBP" ? unitPrice : convertCnyToGbp(unitPrice);
}

export async function createStripeCheckoutSession(input: {
  orderId: string | number;
  orderNumber: string;
  customerEmail: string;
  portalCurrency: string;
  lines: StripeCheckoutLine[];
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  const baseUrl = getSiteUrl();

  const lineItems = input.lines.map((line) => ({
    price_data: {
      currency: "gbp",
      unit_amount: Math.round(line.unitAmountGbp * 100),
      product_data: { name: line.name },
    },
    quantity: line.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    line_items: lineItems,
    metadata: {
      order_id: String(input.orderId),
      order_number: input.orderNumber,
      portal_currency: input.portalCurrency,
    },
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout/cancel?order_number=${encodeURIComponent(input.orderNumber)}`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { sessionId: session.id, url: session.url };
}
