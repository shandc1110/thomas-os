import "server-only";
import { JoybuyNotConfiguredError } from "./errors";
import type { JoybuySignMethod } from "./sign";

/**
 * Server-only Joybuy configuration.
 * Validates only when Joybuy functionality is invoked — the app boots without these.
 *
 * Production must NOT be the default base URL. Prefer pre-release while testing:
 *   JOYBUY_API_BASE_URL=https://api-pre.joybuy.com/rest
 */

export type JoybuyConfig = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  apiBaseUrl: string;
  callbackUrl: string | null;
  /** Default MD5 per official docs. */
  signMethod: JoybuySignMethod;
  /** UK marketplace defaults (sent as headers; not part of signature). */
  site: string;
  currency: string;
  language: string;
  /**
   * Only send X-JOS-timeZone when explicitly configured.
   * Official docs list Asia/Shanghai | Asia/Tokyo | Asia/Singapore | Asia/Seoul —
   * do not invent a UK timezone value.
   */
  timeZone: string | null;
  /** Only send X-JOS-Request-BizId when the Joybuy merchant/vendor value is known. */
  requestBizId: string | null;
};

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function readSignMethod(): JoybuySignMethod {
  const raw = read("JOYBUY_SIGN_METHOD").toLowerCase();
  if (raw === "hmacsha256" || raw === "hmacmd5" || raw === "md5") return raw;
  return "md5";
}

/** True when all required env vars for a live client are present. */
export function isJoybuyConfigured(): boolean {
  return Boolean(
    read("JOYBUY_APP_KEY") &&
      read("JOYBUY_APP_SECRET") &&
      read("JOYBUY_ACCESS_TOKEN") &&
      read("JOYBUY_API_BASE_URL"),
  );
}

/**
 * Returns config or throws JoybuyNotConfiguredError.
 * Never logs secret values.
 */
export function getJoybuyConfig(): JoybuyConfig {
  const appKey = read("JOYBUY_APP_KEY");
  const appSecret = read("JOYBUY_APP_SECRET");
  const accessToken = read("JOYBUY_ACCESS_TOKEN");
  const apiBaseUrl = read("JOYBUY_API_BASE_URL");
  const callbackUrl = read("JOYBUY_CALLBACK_URL") || null;

  if (!appKey || !appSecret || !accessToken || !apiBaseUrl) {
    throw new JoybuyNotConfiguredError(
      "Joybuy credentials are missing. Set JOYBUY_APP_KEY, JOYBUY_APP_SECRET, JOYBUY_ACCESS_TOKEN, and JOYBUY_API_BASE_URL after app approval.",
    );
  }

  return {
    appKey,
    appSecret,
    accessToken,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    callbackUrl,
    signMethod: readSignMethod(),
    site: read("JOYBUY_SITE") || "UK-Site",
    currency: read("JOYBUY_CURRENCY") || "GBP",
    language: read("JOYBUY_LANGUAGE") || "en_GB",
    timeZone: read("JOYBUY_TIMEZONE") || null,
    requestBizId: read("JOYBUY_REQUEST_BIZ_ID") || null,
  };
}

/** Safe summary for admin UI — never includes secrets. */
export function getJoybuyConfigPresence(): {
  appKey: boolean;
  appSecret: boolean;
  accessToken: boolean;
  apiBaseUrl: boolean;
  callbackUrl: boolean;
  configured: boolean;
} {
  const appKey = Boolean(read("JOYBUY_APP_KEY"));
  const appSecret = Boolean(read("JOYBUY_APP_SECRET"));
  const accessToken = Boolean(read("JOYBUY_ACCESS_TOKEN"));
  const apiBaseUrl = Boolean(read("JOYBUY_API_BASE_URL"));
  const callbackUrl = Boolean(read("JOYBUY_CALLBACK_URL"));
  return {
    appKey,
    appSecret,
    accessToken,
    apiBaseUrl,
    callbackUrl,
    configured: appKey && appSecret && accessToken && apiBaseUrl,
  };
}
