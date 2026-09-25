"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/lib/types";
import { getClientTenant } from "@/lib/thomas/tenant/resolve";
import { getSellableStock } from "@/lib/presell";
import {
  displayUnitPriceForCartLine,
  type OrderPricingChannel,
} from "@/lib/storefront/order-pricing";

export type CartItem = {
  product: Product;
  quantity: number;
  /**
   * Which commercial price the line was added under.
   * Display-only hint — POST /api/orders re-resolves from the DB.
   */
  pricingChannel?: OrderPricingChannel;
};

/** Soft hold: baskets expire after this many minutes without checkout. */
export const CART_HOLD_MINUTES = 30;
const CART_HOLD_MS = CART_HOLD_MINUTES * 60 * 1000;

type PersistedCart = {
  version: 1;
  updatedAt: number;
  items: CartItem[];
};

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  /** True when every line was added under the UK Shopify channel. */
  isShopifyCart: boolean;
  hydrated: boolean;
  /** Soft reservation window shown to customers. */
  holdMinutes: number;
  getQuantity: (productId: Product["id"]) => number;
  addItem: (
    product: Product,
    quantity?: number,
    pricingChannel?: OrderPricingChannel,
  ) => void;
  setQuantity: (productId: Product["id"], quantity: number) => void;
  removeItem: (productId: Product["id"]) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = getClientTenant().commerce.cartStorageKey;
/** Previous key — cleared so uncleared pre-hold baskets are dropped. */
const LEGACY_STORAGE_KEYS = ["thomas-cart-chosen-by-chloe-v1"];

function clampToStock(quantity: number, product: Product): number {
  const sellable = getSellableStock(product);
  if (quantity < 0) return 0;
  if (quantity > sellable) return sellable;
  return quantity;
}

function normaliseStoredItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as CartItem;
  if (!entry.product || !(entry.quantity > 0)) return null;
  const pricingChannel =
    entry.pricingChannel === "shopify"
      ? "shopify"
      : entry.pricingChannel === "community"
        ? "community"
        : undefined;
  return { product: entry.product, quantity: entry.quantity, pricingChannel };
}

function readPersistedCart(): { items: CartItem[]; updatedAt: number } {
  try {
    for (const legacy of LEGACY_STORAGE_KEYS) {
      window.localStorage.removeItem(legacy);
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], updatedAt: Date.now() };

    const parsed = JSON.parse(raw) as unknown;

    // Legacy bare array — treat as expired (force clear).
    if (Array.isArray(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { items: [], updatedAt: Date.now() };
    }

    if (!parsed || typeof parsed !== "object") {
      return { items: [], updatedAt: Date.now() };
    }

    const bag = parsed as PersistedCart;
    const updatedAt = typeof bag.updatedAt === "number" ? bag.updatedAt : 0;
    if (!updatedAt || Date.now() - updatedAt > CART_HOLD_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { items: [], updatedAt: Date.now() };
    }

    const items = Array.isArray(bag.items)
      ? bag.items.map(normaliseStoredItem).filter((item): item is CartItem => item != null)
      : [];

    return { items, updatedAt };
  } catch {
    return { items: [], updatedAt: Date.now() };
  }
}

function writePersistedCart(items: CartItem[], updatedAt: number) {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: PersistedCart = { version: 1, updatedAt, items };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = readPersistedCart();
    setItems(loaded.items);
    setUpdatedAt(loaded.updatedAt);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writePersistedCart(items, updatedAt);
  }, [items, updatedAt, hydrated]);

  // Expire the basket when the 30-minute hold elapses while the tab is open.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;

    const remaining = CART_HOLD_MS - (Date.now() - updatedAt);
    if (remaining <= 0) {
      setItems([]);
      setUpdatedAt(Date.now());
      return;
    }

    const timer = window.setTimeout(() => {
      setItems([]);
      setUpdatedAt(Date.now());
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [hydrated, items.length, updatedAt]);

  const touch = useCallback(() => setUpdatedAt(Date.now()), []);

  const getQuantity = useCallback(
    (productId: Product["id"]) => {
      const match = items.find((item) => String(item.product.id) === String(productId));
      return match?.quantity ?? 0;
    },
    [items],
  );

  const addItem = useCallback(
    (product: Product, quantity = 1, pricingChannel?: OrderPricingChannel) => {
      touch();
      setItems((prev) => {
        const key = String(product.id);
        const channel = pricingChannel ?? "community";
        const existing = prev.find((item) => String(item.product.id) === key);
        if (existing) {
          return prev.map((item) =>
            String(item.product.id) === key
              ? {
                  product,
                  quantity: clampToStock(item.quantity + quantity, product),
                  pricingChannel: channel,
                }
              : item,
          );
        }
        const next = clampToStock(quantity, product);
        if (next <= 0) return prev;
        return [...prev, { product, quantity: next, pricingChannel: channel }];
      });
    },
    [touch],
  );

  const setQuantity = useCallback(
    (productId: Product["id"], quantity: number) => {
      touch();
      setItems((prev) => {
        const key = String(productId);
        return prev
          .map((item) =>
            String(item.product.id) === key
              ? {
                  product: item.product,
                  quantity: clampToStock(quantity, item.product),
                  pricingChannel: item.pricingChannel,
                }
              : item,
          )
          .filter((item) => item.quantity > 0);
      });
    },
    [touch],
  );

  const removeItem = useCallback(
    (productId: Product["id"]) => {
      touch();
      setItems((prev) => prev.filter((item) => String(item.product.id) !== String(productId)));
    },
    [touch],
  );

  const clear = useCallback(() => {
    touch();
    setItems([]);
  }, [touch]);

  const isShopifyCart =
    items.length > 0 && items.every((item) => item.pricingChannel === "shopify");

  const { totalItems, totalPrice } = useMemo(() => {
    let count = 0;
    let price = 0;
    for (const item of items) {
      count += item.quantity;
      const { unitPrice } = displayUnitPriceForCartLine(
        item.product,
        item.pricingChannel,
        isShopifyCart ? "GBP" : "CNY",
      );
      price += unitPrice * item.quantity;
    }
    return { totalItems: count, totalPrice: price };
  }, [items, isShopifyCart]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      totalPrice,
      isShopifyCart,
      hydrated,
      holdMinutes: CART_HOLD_MINUTES,
      getQuantity,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [
      items,
      totalItems,
      totalPrice,
      isShopifyCart,
      hydrated,
      getQuantity,
      addItem,
      setQuantity,
      removeItem,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
