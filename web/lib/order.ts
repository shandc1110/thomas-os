import type { Product } from "./types";

export type OrderItemInput = {
  product_id: Product["id"];
  quantity: number;
};

export type OrderCustomer = {
  name: string;
  wechat_name: string;
  phone: string;
  notes?: string;
};

export type CreateOrderRequest = {
  customer: OrderCustomer;
  items: OrderItemInput[];
};

export type StockIssue = {
  product_id: Product["id"];
  name: string;
  requested: number;
  available: number;
};

export type CreateOrderSuccess = {
  success: true;
  order_id: Product["id"];
  total: number;
};

export type CreateOrderError = {
  success: false;
  error: string;
  issues?: StockIssue[];
};

export type CreateOrderResponse = CreateOrderSuccess | CreateOrderError;
