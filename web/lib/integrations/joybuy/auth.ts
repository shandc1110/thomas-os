import "server-only";
import { getJoybuyConfig, type JoybuyConfig } from "./config";
import { JoybuyApiNotImplementedError } from "./errors";

/**
 * Authentication adapter placeholder.
 *
 * Official Joybuy signing / OAuth parameters are NOT implemented here.
 * Wire the verified protocol from Joybuy Open Platform docs into this module only.
 */
export async function authenticateJoybuy(
  _config?: JoybuyConfig,
): Promise<{ accessToken: string }> {
  const config = _config ?? getJoybuyConfig();
  void config;
  throw new JoybuyApiNotImplementedError(
    "Joybuy authenticate() is not implemented until the official auth flow is confirmed.",
  );
}

/**
 * Returns a bearer-style token placeholder for future HTTP calls.
 * Does not invent signing algorithms.
 */
export async function getJoybuyAccessToken(): Promise<string> {
  const config = getJoybuyConfig();
  // When official refresh/signing exists, replace this path.
  // For now credentials presence is validated but live auth is not implemented.
  void config.accessToken;
  throw new JoybuyApiNotImplementedError(
    "Joybuy access-token resolution is not implemented until the official auth flow is confirmed.",
  );
}
