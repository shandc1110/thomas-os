import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import { sendOrderConfirmationEmail } from "../lib/order-email";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type OrderRow = {
  id: string | number;
  order_number: string | null;
  customer_name: string | null;
  first_name: string | null;
  last_name: string | null;
  wechat_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  payment_method: string | null;
  currency: string | null;
  notes: string | null;
  created_at?: string;
};

type OrderItemRow = {
  order_id: string | number;
  product_id: string | number;
  quantity: number;
  price: number | null;
};

// Where to send these resends. Defaults to the shop's own inbox so existing
// customers are NOT emailed again. Pass an order id as arg 1, and optionally a
// different override recipient as arg 2.
const OVERRIDE_RECIPIENT =
  process.env.RESEND_OVERRIDE_TO ?? "dongchen@chosenbychloe.com";

async function run() {
  const orderIdArg = process.argv[2];
  const overrideArg = process.argv[3] ?? OVERRIDE_RECIPIENT;

  // Don't also CC the shop inbox on these internal resends (avoids duplicates).
  process.env.ORDER_EMAIL_CC = "";

  let orderQuery = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (orderIdArg) orderQuery = orderQuery.eq("id", orderIdArg);

  const { data: orders, error: ordersError } = await orderQuery;
  if (ordersError) throw ordersError;
  if (!orders?.length) {
    console.log("No orders found.");
    return;
  }

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, product_id, quantity, price")
    .in("order_id", orderIds);
  if (itemsError) throw itemsError;

  const productIds = [...new Set((items ?? []).map((item) => item.product_id))];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name")
    .in("id", productIds);
  if (productsError) throw productsError;

  const productNames = new Map(
    (products ?? []).map((p) => [String(p.id), String(p.name)]),
  );

  for (const order of orders as OrderRow[]) {
    const orderItems = ((items ?? []) as OrderItemRow[]).filter(
      (item) => String(item.order_id) === String(order.id),
    );

    if (!order.email) {
      console.log(`skip ${order.id}: no email on order`);
      continue;
    }

    const payloadItems = orderItems.map((item) => ({
      name: productNames.get(String(item.product_id)) ?? "Unknown item",
      quantity: item.quantity,
      price: item.price ?? 0,
    }));

    const total = payloadItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const currency = order.currency?.toUpperCase() === "GBP" ? "GBP" : "CNY";

    const orderNumber = order.order_number ?? String(order.id);

    const sent = await sendOrderConfirmationEmail({
      orderNumber,
      customer: {
        first_name: order.first_name ?? order.customer_name?.split(" ")[0] ?? "",
        last_name:
          order.last_name ?? order.customer_name?.split(" ").slice(1).join(" ") ?? "",
        wechat_name: order.wechat_name ?? "",
        phone: order.phone ?? "",
        email: overrideArg,
        address: order.address ?? "",
        postcode: order.postcode ?? "",
        payment_method: order.payment_method ?? "",
        currency,
        notes: order.notes ?? undefined,
      },
      items: payloadItems,
      total,
    });

    console.log(
      `${sent ? "sent" : "failed"} ${orderNumber} (#${order.id}) -> ${overrideArg} (customer: ${order.customer_name ?? "unknown"}, original: ${order.email})`,
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
