/** Checkout payment method value stored on orders. */
export const STRIPE_PAYMENT_METHOD = "Pay by card (Stripe)";

export function isStripePaymentMethod(method: string | null | undefined): boolean {
  return method?.trim() === STRIPE_PAYMENT_METHOD;
}
