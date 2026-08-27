/**
 * Structured Joybuy logging — never log secrets, auth codes, full addresses, or payments.
 */

export type JoybuyLogFields = {
  operation: string;
  level?: "info" | "warn" | "error";
  message?: string;
  sku?: string | null;
  internalProductId?: string | null;
  externalId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  organizationId?: string | null;
};

const SECRET_KEYS = /secret|token|password|authorization|appsecret|access.?token/i;

export function joybuyLog(fields: JoybuyLogFields): void {
  const safe: Record<string, unknown> = {
    channel: "joybuy",
    timestamp: new Date().toISOString(),
    operation: fields.operation,
    level: fields.level ?? "info",
  };

  if (fields.message) safe.message = fields.message;
  if (fields.sku != null) safe.sku = fields.sku;
  if (fields.internalProductId != null) safe.internalProductId = fields.internalProductId;
  if (fields.externalId != null) safe.externalId = fields.externalId;
  if (fields.httpStatus != null) safe.httpStatus = fields.httpStatus;
  if (fields.errorCode != null) safe.errorCode = fields.errorCode;
  if (fields.organizationId != null) safe.organizationId = fields.organizationId;

  // Defence: strip any accidental secret-looking keys if callers spread objects later.
  for (const key of Object.keys(safe)) {
    if (SECRET_KEYS.test(key)) delete safe[key];
  }

  const line = JSON.stringify(safe);
  if (fields.level === "error") console.error(line);
  else if (fields.level === "warn") console.warn(line);
  else console.info(line);
}
