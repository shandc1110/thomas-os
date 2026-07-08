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

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  hydrated: boolean;
  getQuantity: (productId: Product["id"]) => number;
  addItem: (product: Product, quantity?: number) => void;
  setQuantity: (productId: Product["id"], quantity: number) => void;
  removeItem: (productId: Product["id"]) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "cbc-cart-v1";

function clampToStock(quantity: number, product: Product): number {
  const stock = product.stock ?? 0;
  if (quantity < 0) return 0;
  if (quantity > stock) return stock;
  return quantity;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((item) => item?.product && item.quantity > 0));
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

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const key = String(product.id);
      const existing = prev.find((item) => String(item.product.id) === key);
      if (existing) {
        return prev.map((item) =>
          String(item.product.id) === key
            ? {
                product,
                quantity: clampToStock(item.quantity + quantity, product),
              }
            : item,
        );
      }
      const next = clampToStock(quantity, product);
      if (next <= 0) return prev;
      return [...prev, { product, quantity: next }];
    });
  }, []);

  const setQuantity = useCallback((productId: Product["id"], quantity: number) => {
    setItems((prev) => {
      const key = String(productId);
      return prev
        .map((item) =>
          String(item.product.id) === key
            ? { product: item.product, quantity: clampToStock(quantity, item.product) }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
  }, []);

  const removeItem = useCallback((productId: Product["id"]) => {
    setItems((prev) => prev.filter((item) => String(item.product.id) !== String(productId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { totalItems, totalPrice } = useMemo(() => {
    let count = 0;
    let price = 0;
    for (const item of items) {
      count += item.quantity;
      price += (item.product.price ?? 0) * item.quantity;
    }
    return { totalItems: count, totalPrice: price };
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      totalPrice,
      hydrated,
      getQuantity,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [items, totalItems, totalPrice, hydrated, getQuantity, addItem, setQuantity, removeItem, clear],
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
