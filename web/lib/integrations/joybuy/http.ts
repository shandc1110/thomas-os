import "server-only";
import { getJoybuyConfig, type JoybuyConfig } from "./config";
import { JoybuyApiError } from "./errors";
import { joybuyLog } from "./log";
import {
  createJoybuySignature,
  serializeJoybuyBody,
  type JoybuySignMethod,
} from "./sign";
import type { JoybuyApiEnvelope, JoybuyApiErrorItem } from "./types";
import { coerceJoybuyFlag } from "./flags";

export { coerceJoybuyFlag } from "./flags";

export type JoybuyHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type JoybuyHttpRequestOptions = {
  method: JoybuyHttpMethod;
  /**
   * Path relative to JOYBUY_API_BASE_URL, e.g. `/product/v1/xxx`
   * or with placeholders `/order/{orderId}` when pathParams provided.
   */
  path: string;
  pathParams?: Record<string, string | number | boolean | null | undefined>;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  /** Object body — serialized once with compact JSON for both sign + send. */
  body?: unknown;
  /** Override access token; pass null/"" to omit token from headers + signature. */
  accessToken?: string | null;
  /** Override default config sign method for this request. */
  signMethod?: JoybuySignMethod;
  /** Override X-JOS-Request-BizId for this request only when known. */
  requestBizId?: string | null;
  /** Override UK site headers for this request. */
  site?: string;
  currency?: string;
  language?: string;
  timeZone?: string | null;
  /** Injected for tests — defaults to Date.now(). */
  timestampMs?: number;
  /** Injected for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  config?: JoybuyConfig;
};

export type JoybuyHttpResponse<T = unknown> = {
  httpStatus: number;
  envelope: JoybuyApiEnvelope<T>;
  data: T | undefined;
  /** Exact body string that was signed and sent (null when no body). */
  requestBody: string | null;
  signature: string;
  headersSent: Record<string, string>;
};

function applyPathParams(
  pathTemplate: string,
  pathParams: Record<string, string | number | boolean | null | undefined> | undefined,
): string {
  let path = pathTemplate.startsWith("/") ? pathTemplate : `/${pathTemplate}`;
  for (const [name, value] of Object.entries(pathParams ?? {})) {
    if (value === null || value === undefined) continue;
    path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
  }
  return path;
}

function buildQueryString(
  queryParams: Record<string, string | number | boolean | null | undefined> | undefined,
): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(queryParams ?? {})) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.length === 0) continue;
    parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function parseEnvelope(raw: unknown): JoybuyApiEnvelope {
  if (!raw || typeof raw !== "object") {
    return { success: false, data: raw, errorList: [] };
  }
  const obj = raw as Record<string, unknown>;
  const errorList = Array.isArray(obj.errorList)
    ? (obj.errorList as JoybuyApiErrorItem[])
    : [];
  const coerced = coerceJoybuyFlag(obj.success);
  return {
    success: coerced === null ? Boolean(obj.success) : coerced,
    data: obj.data,
    errorList,
    requestId:
      typeof obj.requestId === "string"
        ? obj.requestId
        : typeof obj.traceId === "string"
          ? obj.traceId
          : null,
    traceId: typeof obj.traceId === "string" ? obj.traceId : null,
  };
}

function throwFromEnvelope(httpStatus: number, envelope: JoybuyApiEnvelope): never {
  const first = envelope.errorList?.[0];
  throw new JoybuyApiError({
    httpStatus,
    message: first?.message || `Joybuy API request failed (HTTP ${httpStatus}).`,
    joybuyCode: first?.code ?? null,
    details: first?.details ?? null,
    requestId: envelope.requestId ?? envelope.traceId ?? null,
    errorList: envelope.errorList ?? [],
  });
}

/**
 * Signed Joybuy SP-API HTTP request.
 * Serializes the body once and uses that exact string for signing and the wire body.
 * Never logs appSecret, accessToken, or signature material.
 */
export async function joybuyRequest<T = unknown>(
  options: JoybuyHttpRequestOptions,
): Promise<JoybuyHttpResponse<T>> {
  const config = options.config ?? getJoybuyConfig();
  const timestamp = options.timestampMs ?? Date.now();
  const signMethod = options.signMethod ?? config.signMethod;

  const accessToken =
    options.accessToken === undefined ? config.accessToken : options.accessToken;

  const resolvedPath = applyPathParams(options.path, options.pathParams);
  const queryString = buildQueryString(options.queryParams);

  const requestBody =
    options.body === undefined || options.body === null
      ? null
      : serializeJoybuyBody(options.body);

  const signed = createJoybuySignature({
    appKey: config.appKey,
    appSecret: config.appSecret,
    accessToken,
    timestamp,
    pathParams: options.pathParams,
    queryParams: options.queryParams,
    body: requestBody,
    signMethod,
  });

  const headers: Record<string, string> = {
    "X-JOS-App-Key": config.appKey,
    "X-JOS-Timestamp": String(timestamp),
    "X-JOS-Sign": signed.signature,
    "X-JOS-Content-Type": "application/json; charset=utf-8",
    "X-JOS-Request-Identity": "vender",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (typeof accessToken === "string" && accessToken.length > 0) {
    headers["X-JOS-Access-Token"] = accessToken;
  }

  if (signMethod !== "md5") {
    headers["X-JOS-Sign-Method"] = signMethod;
  }

  const site = options.site ?? config.site;
  const currency = options.currency ?? config.currency;
  const language = options.language ?? config.language;
  if (site) headers["X-JOS-site"] = site;
  if (currency) headers["X-JOS-currency"] = currency;
  if (language) headers["X-JOS-language"] = language;

  const timeZone = options.timeZone === undefined ? config.timeZone : options.timeZone;
  if (timeZone) headers["X-JOS-timeZone"] = timeZone;

  const requestBizId =
    options.requestBizId === undefined ? config.requestBizId : options.requestBizId;
  if (requestBizId) headers["X-JOS-Request-BizId"] = requestBizId;

  const url = `${config.apiBaseUrl}${resolvedPath}${queryString}`;
  const fetchImpl = options.fetchImpl ?? fetch;

  joybuyLog({
    operation: "httpRequest",
    message: `${options.method} ${resolvedPath}`,
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: options.method,
      headers,
      body: requestBody ?? undefined,
    });
  } catch {
    throw new JoybuyApiError({
      httpStatus: 0,
      message: "Joybuy HTTP transport error.",
      joybuyCode: "JOYBUY_HTTP_ERROR",
    });
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new JoybuyApiError({
        httpStatus: response.status,
        message: "Joybuy response was not valid JSON.",
        joybuyCode: "JOYBUY_HTTP_ERROR",
      });
    }
  }

  const envelope = parseEnvelope(parsed);

  if (!response.ok) {
    joybuyLog({
      operation: "httpRequest",
      level: "warn",
      httpStatus: response.status,
      errorCode: envelope.errorList?.[0]?.code ?? "HTTP_ERROR",
      message: "Joybuy HTTP error response",
    });
    throwFromEnvelope(response.status, envelope);
  }

  if (envelope.success === false) {
    joybuyLog({
      operation: "httpRequest",
      level: "warn",
      httpStatus: response.status,
      errorCode: envelope.errorList?.[0]?.code ?? "API_ERROR",
      message: "Joybuy business error response",
    });
    throwFromEnvelope(response.status, envelope);
  }

  // success=true alone is not enough when errorList carries a business error.
  if ((envelope.errorList?.length ?? 0) > 0) {
    joybuyLog({
      operation: "httpRequest",
      level: "warn",
      httpStatus: response.status,
      errorCode: envelope.errorList?.[0]?.code ?? "API_ERROR",
      message: "Joybuy errorList present despite success flag",
    });
    throwFromEnvelope(response.status, envelope);
  }

  return {
    httpStatus: response.status,
    envelope: envelope as JoybuyApiEnvelope<T>,
    data: envelope.data as T | undefined,
    requestBody,
    signature: signed.signature,
    headersSent: headers,
  };
}
