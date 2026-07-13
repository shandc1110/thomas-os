import { Resend } from "resend";
import type { OrderCustomer } from "./order";

const LOGO_URL =
  "https://chosenbychloe.com/cdn/shop/files/TopLogo.jpg?v=1764941405&width=160";

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

function formatOrderPrice(amount: number, currency: string): string {
  const code = currency === "GBP" ? "GBP" : "CNY";
  const locale = currency === "GBP" ? "en-GB" : "zh-CN";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
  }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildText(payload: OrderEmailPayload): string {
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
    "Chosen by Chloe",
  );

  return lines.join("\n");
}

function buildHtml(payload: OrderEmailPayload): string {
  const { orderNumber, customer, items, total } = payload;
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0e8e4;color:#3d2f2a;">${escapeHtml(item.name)}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #f0e8e4;color:#6b5b55;text-align:center;">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0e8e4;color:#3d2f2a;text-align:right;">${formatOrderPrice(item.price * item.quantity, customer.currency)}</td>
        </tr>`,
    )
    .join("");

  const notes = customer.notes
    ? `<p style="margin:16px 0 0;color:#6b5b55;"><strong>Notes:</strong> ${escapeHtml(customer.notes)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#faf6f2;font-family:Arial,sans-serif;color:#3d2f2a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img
          src="${LOGO_URL}"
          alt="Chosen by Chloe"
          width="72"
          height="72"
          style="display:inline-block;width:72px;height:72px;border-radius:9999px;object-fit:cover;border:1px solid #f0e8e4;"
        />
      </div>
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#b08b7d;text-align:center;">Chosen by Chloe</p>
      <h1 style="margin:0 0 12px;font-size:28px;font-weight:normal;color:#3d2f2a;text-align:center;">Thank you for your order</h1>
      <p style="margin:0 0 24px;color:#6b5b55;line-height:1.6;">
        Hi ${escapeHtml(fullName)}, we've received your order. We'll be in touch on WeChat to confirm payment and delivery.
      </p>
      <p style="margin:0 0 24px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:#b08b7d;">
        Reference ${escapeHtml(orderNumber)}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="padding:0 0 8px;text-align:left;font-size:12px;color:#b08b7d;text-transform:uppercase;letter-spacing:0.1em;">Item</th>
            <th style="padding:0 8px 8px;text-align:center;font-size:12px;color:#b08b7d;text-transform:uppercase;letter-spacing:0.1em;">Qty</th>
            <th style="padding:0 0 8px;text-align:right;font-size:12px;color:#b08b7d;text-transform:uppercase;letter-spacing:0.1em;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="margin:0 0 24px;text-align:right;font-size:18px;color:#3d2f2a;">
        <strong>Total: ${formatOrderPrice(total, customer.currency)}</strong>
      </p>
      <div style="background:#fff;border:1px solid #f0e8e4;border-radius:16px;padding:20px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#b08b7d;">Delivery details</p>
        <p style="margin:0 0 12px;line-height:1.6;white-space:pre-line;">${escapeHtml(customer.address)}</p>
        <p style="margin:0 0 12px;line-height:1.6;">Postcode: ${escapeHtml(customer.postcode)}</p>
        <p style="margin:0;color:#6b5b55;line-height:1.8;">
          WeChat ID: ${escapeHtml(customer.wechat_name)}<br />
          Phone: ${escapeHtml(customer.phone)}<br />
          Payment method: ${escapeHtml(customer.payment_method)}<br />
          Currency: ${escapeHtml(customer.currency)}
        </p>
        ${notes}
      </div>
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
  const cc = (process.env.ORDER_EMAIL_CC ?? "dongchen@chosenbychloe.com")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  const { error } = await resend.emails.send({
    from,
    to: payload.customer.email,
    cc,
    subject: `Order confirmation ${payload.orderNumber} – Chosen by Chloe`,
    html: buildHtml(payload),
    text: buildText(payload),
  });

  if (error) {
    console.error("Order confirmation email failed:", error);
    return false;
  }

  return true;
}
