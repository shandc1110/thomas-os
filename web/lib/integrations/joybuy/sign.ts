/**
 * Joybuy Open Platform SP-API request signing.
 *
 * Pure crypto helpers — no secrets logged, no I/O.
 * Algorithm (official):
 * 1. Collect sign params: X-JOS-App-Key, X-JOS-Access-Token (if present),
 *    X-JOS-Timestamp, path params, query params, request body (if present).
 * 2. Sort parameter names ASCII ascending.
 * 3. Concatenate name+value with no separators.
 * 4. MD5 (default): MD5(AppSecret + concat + AppSecret).hex → UPPERCASE
 *    HMAC-SHA256 / HMAC-MD5: HMAC(key=AppSecret, message=concat).hex → UPPERCASE
 *
 * Body: when present, the exact serialized body string is included as a sign
 * parameter whose name is the empty string (""). Empty string sorts first in
 * ASCII order. Do not invent a "$" separator — concat is name+value only.
 */

import { createHash, createHmac } from "node:crypto";

export type JoybuySignMethod = "md5" | "hmacsha256" | "hmacmd5";

export type CreateJoybuySignatureInput = {
  appKey: string;
  /** Omit or leave empty when the API does not require an access token. */
  accessToken?: string | null;
  /** Millisecond epoch as number or numeric string. */
  timestamp: number | string;
  pathParams?: Record<string, string | number | boolean | null | undefined>;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  /** Exact body string that will be sent on the wire (compact JSON). */
  body?: string | null;
  appSecret: string;
  signMethod?: JoybuySignMethod;
};

export type JoybuySignatureResult = {
  signature: string;
  signMethod: JoybuySignMethod;
  /** Sorted name+value concatenation (no AppSecret). For tests only — never log in prod. */
  concatenatedParameters: string;
  /** Parameter map used for signing (excludes appSecret). */
  parameters: Record<string, string>;
};

function isPresent(value: unknown): value is string | number | boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  return true;
}

function asParamValue(value: string | number | boolean): string {
  return String(value);
}

/**
 * Compact JSON for Joybuy bodies. Must be used for both signing and the HTTP body.
 */
export function serializeJoybuyBody(body: unknown): string {
  return JSON.stringify(body);
}

/**
 * Build the parameter map that participates in the signature.
 * Does not include AppSecret, Sign, or non-sign headers (site/currency/etc.).
 */
export function buildJoybuySignParameters(input: {
  appKey: string;
  accessToken?: string | null;
  timestamp: number | string;
  pathParams?: Record<string, string | number | boolean | null | undefined>;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  body?: string | null;
}): Record<string, string> {
  const parameters: Record<string, string> = {
    "X-JOS-App-Key": input.appKey,
    "X-JOS-Timestamp": String(input.timestamp),
  };

  if (isPresent(input.accessToken) && String(input.accessToken).length > 0) {
    parameters["X-JOS-Access-Token"] = String(input.accessToken);
  }

  for (const [name, value] of Object.entries(input.pathParams ?? {})) {
    if (!isPresent(value)) continue;
    parameters[name] = asParamValue(value);
  }

  for (const [name, value] of Object.entries(input.queryParams ?? {})) {
    if (!isPresent(value)) continue;
    parameters[name] = asParamValue(value);
  }

  // Exact body string as a parameter with empty name (ASCII-sorts first).
  if (typeof input.body === "string" && input.body.length > 0) {
    parameters[""] = input.body;
  }

  return parameters;
}

/** ASCII-ascending sort of parameter names, then name+value with no separators. */
export function concatenateJoybuySignParameters(
  parameters: Record<string, string>,
): string {
  const names = Object.keys(parameters).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let out = "";
  for (const name of names) {
    out += name + parameters[name];
  }
  return out;
}

function digestMd5Upper(signString: string): string {
  return createHash("md5").update(signString, "utf8").digest("hex").toUpperCase();
}

function digestHmacUpper(
  algorithm: "sha256" | "md5",
  appSecret: string,
  message: string,
): string {
  return createHmac(algorithm, appSecret).update(message, "utf8").digest("hex").toUpperCase();
}

export function createJoybuySignature(
  input: CreateJoybuySignatureInput,
): JoybuySignatureResult {
  const signMethod: JoybuySignMethod = input.signMethod ?? "md5";
  const parameters = buildJoybuySignParameters({
    appKey: input.appKey,
    accessToken: input.accessToken,
    timestamp: input.timestamp,
    pathParams: input.pathParams,
    queryParams: input.queryParams,
    body: input.body,
  });
  const concatenatedParameters = concatenateJoybuySignParameters(parameters);

  let signature: string;
  if (signMethod === "hmacsha256") {
    signature = digestHmacUpper("sha256", input.appSecret, concatenatedParameters);
  } else if (signMethod === "hmacmd5") {
    signature = digestHmacUpper("md5", input.appSecret, concatenatedParameters);
  } else {
    // Default MD5: AppSecret + concatenatedParameters + AppSecret
    signature = digestMd5Upper(input.appSecret + concatenatedParameters + input.appSecret);
  }

  return {
    signature,
    signMethod,
    concatenatedParameters,
    parameters,
  };
}
