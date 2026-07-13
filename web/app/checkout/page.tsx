"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/context/CartContext";
import { CNY_TO_GBP_RATE, priceForCurrency } from "@/lib/currency";
import { formatOrderPrice } from "@/lib/format";
import type { CreateOrderResponse, StockIssue } from "@/lib/order";

type FormState = {
  first_name: string;
  last_name: string;
  wechat_name: string;
  email: string;
  address: string;
  postcode: string;
  phone: string;
  payment_method: string;
  currency: string;
  notes: string;
};

const initialForm: FormState = {
  first_name: "",
  last_name: "",
  wechat_name: "",
  email: "",
  address: "",
  postcode: "",
  phone: "",
  payment_method: "",
  currency: "CNY",
  notes: "",
};

const PAYMENT_METHODS = ["Bank transfer", "WeChat Pay", "Alipay"];

const CURRENCIES = [
  { value: "CNY", label: "RMB (¥)" },
  { value: "GBP", label: "GBP (£)" },
];

export default function CheckoutPage() {
  const { items, totalItems, totalPrice, hydrated, setQuantity, removeItem, clear } = useCart();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<StockIssue[]>([]);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | number | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);

  const displayTotal = useMemo(
    () => priceForCurrency(totalPrice, form.currency),
    [totalPrice, form.currency],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function itemDisplayPrice(cnyPrice: number | null | undefined): string {
    return formatOrderPrice(priceForCurrency(cnyPrice ?? 0, form.currency), form.currency);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIssues([]);
    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            first_name: form.first_name,
            last_name: form.last_name,
            wechat_name: form.wechat_name,
            phone: form.phone,
            email: form.email,
            address: form.address,
            postcode: form.postcode,
            payment_method: form.payment_method,
            currency: form.currency,
            notes: form.notes,
          },
          items: items.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = (await response.json()) as CreateOrderResponse;

      if (!response.ok || !result.success) {
        setError(result.success ? "Something went wrong." : result.error);
        if (!result.success && result.issues) setIssues(result.issues);
        return;
      }

      setConfirmedOrderId(result.order_id);
      setConfirmedOrderNumber(result.order_number);
      setConfirmationEmail(form.email);
      setConfirmationEmailSent(result.email_sent);
      clear();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrderId !== null) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cocoa text-2xl text-cream">
          &#10003;
        </div>
        <h1 className="mt-6 font-serif text-3xl text-espresso">Order received</h1>
        <p className="mt-3 max-w-sm text-sm text-muted">
          Thank you! Your order has been placed. We&apos;ll be in touch on WeChat to
          confirm the details.
          {confirmationEmailSent && confirmationEmail
            ? ` A confirmation email has been sent to ${confirmationEmail}.`
            : confirmationEmail
              ? ` We could not send a confirmation email to ${confirmationEmail}, but your order is saved.`
              : ""}
        </p>
        <p className="mt-2 text-xs uppercase tracking-widest text-clay">
          Reference {confirmedOrderNumber ?? String(confirmedOrderId)}
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-espresso"
        >
          Back to shop
        </Link>
      </main>
    );
  }

  if (hydrated && items.length === 0) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-espresso">Your cart is empty</h1>
        <p className="mt-3 max-w-sm text-sm text-muted">
          Add a few favourites to get started.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full bg-cocoa px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-espresso"
        >
          Browse the collection
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between pt-8 pb-6">
        <Link href="/" className="text-sm font-medium text-clay hover:text-cocoa">
          &larr; Continue shopping
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-muted">Checkout</span>
      </header>

      <h1 className="font-serif text-3xl text-espresso">Your order</h1>

      <section className="mt-5 space-y-3">
        {items.map((item) => {
          const stock = item.product.stock ?? 0;
          return (
            <div
              key={String(item.product.id)}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-sand/60"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-linen">
                {item.product.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base text-espresso">
                  {item.product.name}
                </p>
                <p className="text-sm text-muted">{itemDisplayPrice(item.product.price)}</p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1 rounded-full bg-linen p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.product.id, item.quantity - 1)}
                    aria-label={`Decrease ${item.product.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-cocoa shadow-sm"
                  >
                    &minus;
                  </button>
                  <span className="min-w-6 text-center text-sm font-semibold text-espresso">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= stock}
                    aria-label={`Increase ${item.product.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-cocoa text-cream shadow-sm disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.product.id)}
                  className="text-xs text-muted hover:text-cocoa"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-linen px-4 py-3">
        <span className="text-sm text-espresso">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </span>
        <span className="font-serif text-xl text-espresso">
          {formatOrderPrice(displayTotal, form.currency)}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <h2 className="font-serif text-xl text-espresso">Your details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            value={form.first_name}
            onChange={(v) => update("first_name", v)}
            required
            autoComplete="given-name"
          />
          <Field
            label="Last name"
            value={form.last_name}
            onChange={(v) => update("last_name", v)}
            required
            autoComplete="family-name"
          />
        </div>

        <Field
          label="Email address"
          type="email"
          value={form.email}
          onChange={(v) => update("email", v)}
          required
          autoComplete="email"
        />

        <Field
          label="WeChat ID"
          value={form.wechat_name}
          onChange={(v) => update("wechat_name", v)}
          required
        />

        <Field
          label="Phone number"
          type="tel"
          value={form.phone}
          onChange={(v) => update("phone", v)}
          required
          autoComplete="tel"
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-espresso">
            Delivery address
          </span>
          <textarea
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            rows={3}
            required
            autoComplete="street-address"
            className="w-full rounded-2xl border border-sand bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-clay"
            placeholder="Street address, city"
          />
        </label>

        <Field
          label="Postcode"
          value={form.postcode}
          onChange={(v) => update("postcode", v)}
          required
          autoComplete="postal-code"
        />

        <Select
          label="Payment method"
          value={form.payment_method}
          onChange={(v) => update("payment_method", v)}
          placeholder="Select a payment method"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
          required
        />

        <Select
          label="Currency"
          value={form.currency}
          onChange={(v) => update("currency", v)}
          options={CURRENCIES}
          required
        />

        {form.currency === "GBP" && (
          <p className="text-xs text-muted">
            GBP prices use a fixed rate of ¥{CNY_TO_GBP_RATE} = £1.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-espresso">
            Notes <span className="text-muted">(optional)</span>
          </span>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-sand bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-clay"
            placeholder="Anything we should know?"
          />
        </label>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            <p>{error}</p>
            {issues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {issues.map((issue) => (
                  <li key={String(issue.product_id)}>
                    {issue.name}: requested {issue.requested}, {issue.available} available
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || items.length === 0}
          className="w-full rounded-full bg-cocoa px-6 py-4 text-sm font-semibold uppercase tracking-wide text-cream shadow-lg shadow-espresso/20 transition-colors hover:bg-espresso disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "Placing order..."
            : `Place order · ${formatOrderPrice(displayTotal, form.currency)}`}
        </button>
      </form>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
};

function Field({ label, value, onChange, type = "text", required, autoComplete }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-espresso">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-2xl border border-sand bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-clay"
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
};

function Select({ label, value, onChange, options, placeholder, required }: SelectProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-espresso">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full appearance-none rounded-2xl border border-sand bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-clay"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
