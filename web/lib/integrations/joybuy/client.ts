import "server-only";
import { getJoybuyConfig, isJoybuyConfigured } from "./config";
import { JoybuyApiNotImplementedError, JoybuyNotConfiguredError } from "./errors";
import type {
  JoybuyMappedInventory,
  JoybuyMappedPrice,
  JoybuyMappedProduct,
  JoybuyOrder,
  JoybuyShipment,
} from "./types";
import { joybuyLog } from "./log";

/**
 * Server-side Joybuy client abstraction.
 *
 * Methods enforce configuration checks then throw JoybuyApiNotImplementedError.
 * Do NOT invent endpoint paths or fake successful responses.
 */
export type JoybuyClient = {
  authenticate: () => Promise<void>;
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
  // Touch config so missing optional pieces surface consistently.
  getJoybuyConfig();
}

function notImplemented(operation: string): never {
  joybuyLog({
    operation,
    level: "warn",
    message: "Joybuy API adapter not implemented",
  });
  throw new JoybuyApiNotImplementedError(
    `Joybuy ${operation} is not implemented. Official API paths are not confirmed yet.`,
  );
}

export function createJoybuyClient(): JoybuyClient {
  return {
    async authenticate() {
      requireConfigured();
      notImplemented("authenticate");
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
