import "server-only";
import { authenticateJoybuy } from "./auth";
import { getJoybuyConfig, isJoybuyConfigured } from "./config";
import { JoybuyApiNotImplementedError, JoybuyNotConfiguredError } from "./errors";
import { joybuyRequest, type JoybuyHttpRequestOptions, type JoybuyHttpResponse } from "./http";
import { joybuyLog } from "./log";
import type {
  JoybuyMappedInventory,
  JoybuyMappedPrice,
  JoybuyMappedProduct,
  JoybuyOrder,
  JoybuyShipment,
} from "./types";

/**
 * Server-side Joybuy client.
 *
 * Auth + signed HTTP transport are implemented.
 * Domain product/order endpoint paths remain not-implemented until official
 * path contracts are wired (do not invent URLs).
 */
export type JoybuyClient = {
  authenticate: () => Promise<void>;
  /** Low-level signed request helper for verified official paths. */
  request: <T = unknown>(options: JoybuyHttpRequestOptions) => Promise<JoybuyHttpResponse<T>>;
  getProduct: (externalProductId: string) => Promise<unknown>;
  createProduct: (payload: JoybuyMappedProduct) => Promise<{ externalProductId: string }>;
  updateProduct: (
    externalProductId: string,
    payload: JoybuyMappedProduct,
  ) => Promise<void>;
  updateInventory: (payload: JoybuyMappedInventory) => Promise<void>;
  updatePrice: (payload: JoybuyMappedPrice) => Promise<void>;
  getOrder: (externalOrderId: string) => Promise<JoybuyOrder>;
  listOrders: (params?: { since?: string }) => Promise<JoybuyOrder[]>;
  updateOrderStatus: (
    externalOrderId: string,
    status: string,
  ) => Promise<void>;
  submitShipment: (shipment: JoybuyShipment) => Promise<void>;
};

function requireConfigured(): void {
  if (!isJoybuyConfigured()) {
    throw new JoybuyNotConfiguredError();
  }
  getJoybuyConfig();
}

function notImplemented(operation: string): never {
  joybuyLog({
    operation,
    level: "warn",
    message: "Joybuy domain API path not implemented",
  });
  throw new JoybuyApiNotImplementedError(
    `Joybuy ${operation} is not implemented. Official API paths are not confirmed yet.`,
  );
}

export function createJoybuyClient(): JoybuyClient {
  return {
    async authenticate() {
      requireConfigured();
      await authenticateJoybuy();
    },
    async request(options) {
      requireConfigured();
      return joybuyRequest(options);
    },
    async getProduct(externalProductId: string) {
      requireConfigured();
      void externalProductId;
      notImplemented("getProduct");
    },
    async createProduct(payload: JoybuyMappedProduct) {
      requireConfigured();
      void payload;
      notImplemented("createProduct");
    },
    async updateProduct(externalProductId: string, payload: JoybuyMappedProduct) {
      requireConfigured();
      void externalProductId;
      void payload;
      notImplemented("updateProduct");
    },
    async updateInventory(payload: JoybuyMappedInventory) {
      requireConfigured();
      void payload;
      notImplemented("updateInventory");
    },
    async updatePrice(payload: JoybuyMappedPrice) {
      requireConfigured();
      void payload;
      notImplemented("updatePrice");
    },
    async getOrder(externalOrderId: string) {
      requireConfigured();
      void externalOrderId;
      notImplemented("getOrder");
    },
    async listOrders(params?: { since?: string }) {
      requireConfigured();
      void params;
      notImplemented("listOrders");
    },
    async updateOrderStatus(externalOrderId: string, status: string) {
      requireConfigured();
      void externalOrderId;
      void status;
      notImplemented("updateOrderStatus");
    },
    async submitShipment(shipment: JoybuyShipment) {
      requireConfigured();
      void shipment;
      notImplemented("submitShipment");
    },
  };
}

let singleton: JoybuyClient | null = null;

export function getJoybuyClient(): JoybuyClient {
  if (!singleton) singleton = createJoybuyClient();
  return singleton;
}

/** Test helper — clears the singleton between tests if needed. */
export function resetJoybuyClientForTests(): void {
  singleton = null;
}
