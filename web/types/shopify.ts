export type ShopifyGraphQLError = {
  message: string;
  extensions?: { code?: string };
};

export type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyGraphQLError[];
};

export type ShopifyDraftOrderNode = {
  id: string;
  name: string;
  tags: string[];
  note: string | null;
};

export type ShopifyDraftOrderCreateResult = {
  draftOrder: {
    id: string;
    name: string;
    totalWeight: number | null;
  } | null;
  userErrors: { field: string[] | null; message: string }[];
};

export type ShopifySearchDraftOrdersResult = {
  draftOrders: {
    edges: { node: ShopifyDraftOrderNode }[];
  };
};

export type ShopifyPushResult =
  | { success: true; alreadySynced: boolean; draftOrderId: string; adminUrl: string }
  | { success: false; error: string };
