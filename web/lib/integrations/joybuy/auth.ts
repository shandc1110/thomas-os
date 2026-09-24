import "server-only";
import { getJoybuyConfig, type JoybuyConfig } from "./config";
import { JoybuyNotConfiguredError } from "./errors";
import {
  createJoybuySignature,
  type CreateJoybuySignatureInput,
  type JoybuySignatureResult,
  type JoybuySignMethod,
} from "./sign";

export type {
  CreateJoybuySignatureInput,
  JoybuySignatureResult,
  JoybuySignMethod,
} from "./sign";

export {
  buildJoybuySignParameters,
  concatenateJoybuySignParameters,
  createJoybuySignature,
  serializeJoybuyBody,
} from "./sign";

/**
 * Validates Joybuy credentials are present and returns the configured access token.
 * Token refresh / OAuth exchange is not part of the SP-API signing spec and is not invented here.
 */
export async function authenticateJoybuy(
  _config?: JoybuyConfig,
): Promise<{ accessToken: string }> {
  const config = _config ?? getJoybuyConfig();
  if (!config.accessToken) {
    throw new JoybuyNotConfiguredError(
      "Joybuy access token is missing. Set JOYBUY_ACCESS_TOKEN after app approval.",
    );
  }
  return { accessToken: config.accessToken };
}

/** Returns the server-side access token from config (never log this value). */
export async function getJoybuyAccessToken(): Promise<string> {
  const { accessToken } = await authenticateJoybuy();
  return accessToken;
}

/** Convenience wrapper around createJoybuySignature using current config secrets. */
export function signJoybuyRequest(
  input: Omit<CreateJoybuySignatureInput, "appKey" | "appSecret" | "signMethod"> & {
    signMethod?: JoybuySignMethod;
    config?: JoybuyConfig;
  },
): JoybuySignatureResult {
  const config = input.config ?? getJoybuyConfig();
  return createJoybuySignature({
    appKey: config.appKey,
    appSecret: config.appSecret,
    accessToken: input.accessToken,
    timestamp: input.timestamp,
    pathParams: input.pathParams,
    queryParams: input.queryParams,
    body: input.body,
    signMethod: input.signMethod ?? config.signMethod,
  });
}
