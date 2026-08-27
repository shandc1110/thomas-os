import "server-only";
import type { ChannelConnectionSummary } from "@/lib/channels/types";
import { getJoybuyConfigPresence } from "./config";

/**
 * Admin-facing Joybuy status.
 * While the Joybuy Developer Console app is Pending Review, never report `connected`.
 */
export type JoybuyAdminStatus = {
  appName: "Thomas OS";
  businessType: "ISV Applications";
  appType: "ERP Management";
  reviewStatus: "pending_review";
  connection: "not_configured" | "credentials_present_api_pending";
  products: "ready_to_sync";
  inventory: "ready_to_sync";
  orders: "ready_to_connect";
  channel: ChannelConnectionSummary;
  credentials: ReturnType<typeof getJoybuyConfigPresence>;
};

export function getJoybuyChannelSummary(): ChannelConnectionSummary {
  const presence = getJoybuyConfigPresence();
  if (presence.configured) {
    return {
      channel: "joybuy",
      status: "pending",
      label: "Joybuy",
      detail:
        "Credentials present, but official API adapter is not implemented / app may still be under review",
    };
  }
  return {
    channel: "joybuy",
    status: "pending",
    label: "Joybuy",
    detail: "Pending Review — not configured",
  };
}

export function getJoybuyAdminStatus(): JoybuyAdminStatus {
  const credentials = getJoybuyConfigPresence();
  return {
    appName: "Thomas OS",
    businessType: "ISV Applications",
    appType: "ERP Management",
    reviewStatus: "pending_review",
    connection: credentials.configured
      ? "credentials_present_api_pending"
      : "not_configured",
    products: "ready_to_sync",
    inventory: "ready_to_sync",
    orders: "ready_to_connect",
    channel: getJoybuyChannelSummary(),
    credentials,
  };
}
