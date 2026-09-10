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

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  /** True when every line was added under the UK Shopify channel. */
  isShopifyCart: boolean;
  hydrated: boolean;
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
    entry.pricingChannel === "shopify" ? "shopify" : entry.pricingChannel === "community"
      ? "community"
      : undefined;
  return { product: entry.product, quantity: entry.quantity, pricingChannel };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setItems(
            parsed
              .map(normaliseStoredItem)
              .filter((item): item is CartItem => item != null),
          );
        }
      }
    } catch {
      // Ignore malformed storage and start with an empty cart.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage may be unavailable (private mode); ignore.
    }
  }, [items, hydrated]);

  const getQuantity = useCallback(
    (productId: Product["id"]) => {
      const match = items.find((item) => String(item.product.id) === String(productId));
      return match?.quantity ?? 0;
    },
    [items],
  );

  const addItem = useCallback(
    (product: Product, quantity = 1, pricingChannel?: OrderPricingChannel) => {
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
    [],
  );

  const setQuantity = useCallback((productId: Product["id"], quantity: number) => {
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
  }, []);

  const removeItem = useCallback((productId: Product["id"]) => {
    setItems((prev) => prev.filter((item) => String(item.product.id) !== String(productId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

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
