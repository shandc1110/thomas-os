import "server-only";

export type { ChannelId, ChannelConnectionStatus, ChannelConnectionSummary } from "./types";

import type { ChannelConnectionSummary } from "./types";
import { getJoybuyChannelSummary } from "@/lib/integrations/joybuy/status";

/** Known channels and their current high-level status (server-safe summaries). */
export function listChannelSummaries(): ChannelConnectionSummary[] {
  return [
    {
      channel: "shopify",
      status: process.env.SHOPIFY_STORE?.trim() ? "connected" : "disconnected",
      label: "Shopify",
      detail: "Draft-order fulfilment adapter",
    },
    getJoybuyChannelSummary(),
    {
      channel: "wholesale",
      status: "disconnected",
      label: "Wholesale",
      detail: "Not configured",
    },
  ];
}
