"use client";

import { useCallback, useEffect, useState } from "react";
import type { Warehouse } from "@/types/warehouse";

export function useWarehouse() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory/warehouses");
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setWarehouses(result.warehouses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load warehouses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const defaultWarehouse = warehouses.find((w) => w.is_default) ?? warehouses[0] ?? null;

  return { warehouses, defaultWarehouse, loading, error, refresh };
}
