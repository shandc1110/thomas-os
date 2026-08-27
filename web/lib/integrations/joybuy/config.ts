import "server-only";
import { JoybuyNotConfiguredError } from "./errors";

/**
 * Server-only Joybuy configuration.
 * Validates only when Joybuy functionality is invoked — the app boots without these.
 */

export type JoybuyConfig = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  apiBaseUrl: string;
  callbackUrl: string | null;
};

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
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

  return { appKey, appSecret, accessToken, apiBaseUrl, callbackUrl };
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
