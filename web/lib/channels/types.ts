/** Lightweight sales-channel model (Shopify, Joybuy, Wholesale, …). */

export type ChannelId = "shopify" | "joybuy" | "wholesale";

/**
 * Connection lifecycle for a sales channel.
 * Do not use `connected` while Joybuy AppKey/API are unavailable.
 */
export type ChannelConnectionStatus =
  | "disconnected"
  | "pending"
  | "connected"
  | "error";

export type ChannelConnectionSummary = {
  channel: ChannelId;
  status: ChannelConnectionStatus;
  label: string;
  /** Human-readable detail for admin UI (no secrets). */
  detail: string;
};
