"use client";

import { useCallback, useEffect, useState } from "react";
import type { InventoryBalance } from "@/types/inventory";
import type { StockMovement } from "@/types/movement";

export function useInventory(productId?: string) {
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const [balRes, movRes] = await Promise.all([
        fetch(`/api/inventory/products/${productId}?include=balances`),
        fetch(`/api/inventory/movements?product_id=${productId}&limit=20`),
      ]);
      const bal = await balRes.json();
      const mov = await movRes.json();
      if (bal.success) setBalances(bal.balances ?? []);
      if (mov.success) setMovements(mov.movements ?? []);
    } catch {
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balances, movements, loading, error, refresh };
}
