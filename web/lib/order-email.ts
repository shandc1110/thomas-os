import "server-only";
import { Resend } from "resend";
import { cbcV4Assets, cbcV4Brand, cbcV4Colors } from "@/lib/brand/chosen-by-chloe";
import { formatOrderPrice } from "@/lib/format";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import type { OrderCustomer } from "./order";

export type OrderEmailItem = {
  name: string;
  quantity: number;
  price: number;
};

export type OrderEmailPayload = {
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderEmailItem[];
  total: number;
};

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return "http://localhost:3000";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildText(payload: OrderEmailPayload): string {
  const tenant = getActiveTenant();
  const { orderNumber, customer, items, total } = payload;
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const lines = [
    `Thank you for your order, ${fullName}!`,
    "",
    `Order reference: ${orderNumber}`,
    "",
    "Items:",
    ...items.map(
      (item) =>
        `- ${item.name} x${item.quantity} — ${formatOrderPrice(item.price * item.quantity, customer.currency)}`,
    ),
    "",
    `Total: ${formatOrderPrice(total, customer.currency)}`,
    "",
    "Delivery address:",
    customer.address,
    `Postcode: ${customer.postcode}`,
    "",
    `WeChat ID: ${customer.wechat_name}`,
    `Phone: ${customer.phone}`,
    `Payment method: ${customer.payment_method}`,
    `Currency: ${customer.currency}`,
  ];

  if (customer.notes) {
    lines.push("", `Notes: ${customer.notes}`);
  }

  lines.push(
    "",
    "We'll be in touch on WeChat to confirm payment and delivery.",
    "",
    tenant.brand.name,
  );

  return lines.join("\n");
}

function buildHtml(payload: OrderEmailPayload): string {
  const { orderNumber, customer, items, total } = payload;
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const ivory = cbcV4Colors.warmIvory;
  const charcoal = cbcV4Colors.charcoal;
  const sage = cbcV4Colors.sage;
  const white = cbcV4Colors.white;
  const sand = "#e8dfd2";
  const muted = "#6b6a66";
  const logoUrl = `${siteOrigin()}${cbcV4Assets.logoPrimaryHorizontal}`;

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${sand};color:${charcoal};">${escapeHtml(item.name)}</td>
          <td style="padding:12px 8px;border-bottom:1px solid ${sand};color:${muted};text-align:center;">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid ${sand};color:${charcoal};text-align:right;">${formatOrderPrice(item.price * item.quantity, customer.currency)}</td>
        </tr>`,
    )
    .join("");

  const notes = customer.notes
    ? `<p style="margin:16px 0 0;color:${muted};"><strong>Notes:</strong> ${escapeHtml(customer.notes)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:${ivory};font-family:Arial,Helvetica,sans-serif;color:${charcoal};">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:28px;">
        <img
          src="${logoUrl}"
          alt="${escapeHtml(cbcV4Brand.logoAlt)}"
          width="220"
          style="display:inline-block;width:220px;max-width:80%;height:auto;"
        />
      </div>
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:normal;color:${charcoal};text-align:center;">Thank you for your order</h1>
      <p style="margin:0 0 24px;color:${muted};line-height:1.6;text-align:center;">
        Hi ${escapeHtml(fullName)}, we&apos;ve received your order. We&apos;ll be in touch on WeChat to confirm payment and delivery.
      </p>
      <p style="margin:0 0 24px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${sage};text-align:center;">
        Reference ${escapeHtml(orderNumber)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="padding:0 0 8px;text-align:left;font-size:12px;color:${sage};text-transform:uppercase;letter-spacing:0.1em;">Item</th>
            <th style="padding:0 8px 8px;text-align:center;font-size:12px;color:${sage};text-transform:uppercase;letter-spacing:0.1em;">Qty</th>
            <th style="padding:0 0 8px;text-align:right;font-size:12px;color:${sage};text-transform:uppercase;letter-spacing:0.1em;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="margin:0 0 24px;text-align:right;font-size:18px;color:${charcoal};">
        <strong>Total: ${formatOrderPrice(total, customer.currency)}</strong>
      </p>
      <div style="background:${white};border:1px solid ${sand};padding:20px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${sage};">Delivery details</p>
        <p style="margin:0 0 12px;line-height:1.6;white-space:pre-line;">${escapeHtml(customer.address)}</p>
        <p style="margin:0 0 12px;line-height:1.6;">Postcode: ${escapeHtml(customer.postcode)}</p>
        <p style="margin:0;color:${muted};line-height:1.8;">
          WeChat ID: ${escapeHtml(customer.wechat_name)}<br />
          Phone: ${escapeHtml(customer.phone)}<br />
          Payment method: ${escapeHtml(customer.payment_method)}<br />
          Currency: ${escapeHtml(customer.currency)}
        </p>
        ${notes}
      </div>
      <p style="margin:28px 0 0;text-align:center;font-size:12px;color:${muted};">
        ${escapeHtml(cbcV4Brand.displayName)} · ${escapeHtml(cbcV4Brand.tagline)}
      </p>
    </div>
  </body>
</html>`;
}

export async function sendOrderConfirmationEmail(
  payload: OrderEmailPayload,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("Order email skipped: RESEND_API_KEY or ORDER_EMAIL_FROM is not set.");
    return false;
  }

  const resend = new Resend(apiKey);
  const tenant = getActiveTenant();
  const cc = (process.env.ORDER_EMAIL_CC ?? tenant.email.defaultCc)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  const { error } = await resend.emails.send({
    from,
    to: payload.customer.email,
    cc,
    subject: `Order confirmation ${payload.orderNumber} – ${tenant.email.subjectSuffix}`,
    html: buildHtml(payload),
    text: buildText(payload),
  });

  if (error) {
    console.error("Order confirmation email failed:", error);
    return false;
  }

  return true;
}
