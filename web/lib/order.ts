import type { Product } from "./types";

export type OrderItemInput = {
  product_id: Product["id"];
  quantity: number;
};

export type OrderCustomer = {
  first_name: string;
  last_name: string;
  wechat_name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  payment_method: string;
  currency: string;
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
  order_number: string;
  total: number;
  email_sent: boolean;
};

export type CreateOrderError = {
  success: false;
  error: string;
  issues?: StockIssue[];
};

export type CreateOrderResponse = CreateOrderSuccess | CreateOrderError;
