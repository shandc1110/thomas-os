import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Warehouse, WarehouseLocation } from "@/types/warehouse";

export async function listWarehouses(
  supabase: SupabaseClient,
): Promise<{ warehouses: Warehouse[]; error: string | null }> {
  const { data, error } = await supabase
    .from("warehouses")
    .select(`*, warehouse_locations (*)`)
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("listWarehouses failed:", error.message);
    return { warehouses: [], error: error.message };
  }

  const warehouses = (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    address: (row.address as string | null) ?? null,
    is_default: row.is_default as boolean,
    active: row.active as boolean,
    created_at: row.created_at as string,
    locations: ((row as { warehouse_locations?: WarehouseLocation[] }).warehouse_locations ?? []).map(
      (loc) => ({
        id: loc.id,
        warehouse_id: loc.warehouse_id,
        code: loc.code,
        name: loc.name,
        active: loc.active,
        created_at: loc.created_at,
      }),
    ),
  }));

  return { warehouses, error: null };
}

export async function getDefaultWarehouseLocation(
  supabase: SupabaseClient,
): Promise<{ warehouseId: string; locationId: string } | null> {
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id")
    .eq("is_default", true)
    .eq("active", true)
    .limit(1)
    .single();

  if (!warehouse) return null;

  const { data: location } = await supabase
    .from("warehouse_locations")
    .select("id")
    .eq("warehouse_id", warehouse.id)
    .eq("active", true)
    .order("code")
    .limit(1)
    .single();

  if (!location) return null;

  return { warehouseId: warehouse.id as string, locationId: location.id as string };
}

export async function createWarehouse(
  supabase: SupabaseClient,
  input: { code: string; name: string; address?: string },
): Promise<{ warehouse: Warehouse | null; error: string | null }> {
  const { data, error } = await supabase
    .from("warehouses")
    .insert({
      code: input.code.toUpperCase(),
      name: input.name,
      address: input.address ?? null,
    })
    .select()
    .single();

  if (error) return { warehouse: null, error: error.message };
  return {
    warehouse: {
      id: data.id,
      code: data.code,
      name: data.name,
      address: data.address,
      is_default: data.is_default,
      active: data.active,
      created_at: data.created_at,
    },
    error: null,
  };
}

export async function createLocation(
  supabase: SupabaseClient,
  input: { warehouse_id: string; code: string; name?: string },
): Promise<{ location: WarehouseLocation | null; error: string | null }> {
  const { data, error } = await supabase
    .from("warehouse_locations")
    .insert({
      warehouse_id: input.warehouse_id,
      code: input.code.toUpperCase(),
      name: input.name ?? input.code,
    })
    .select()
    .single();

  if (error) return { location: null, error: error.message };
  return {
    location: {
      id: data.id,
      warehouse_id: data.warehouse_id,
      code: data.code,
      name: data.name,
      active: data.active,
      created_at: data.created_at,
    },
    error: null,
  };
}
