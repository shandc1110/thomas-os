import type { JoybuyApiErrorItem, JoybuyErrorCode } from "./types";

export class JoybuyError extends Error {
  readonly code: JoybuyErrorCode;

  constructor(code: JoybuyErrorCode, message: string) {
    super(message);
    this.name = "JoybuyError";
    this.code = code;
  }
}

export class JoybuyNotConfiguredError extends JoybuyError {
  constructor(message = "Joybuy integration is not configured.") {
    super("JOYBUY_NOT_CONFIGURED", message);
    this.name = "JoybuyNotConfiguredError";
  }
}

export class JoybuyApiNotImplementedError extends JoybuyError {
  constructor(
    message = "Joybuy API adapter is not implemented. Official endpoints are not confirmed yet.",
  ) {
    super("JOYBUY_NOT_IMPLEMENTED", message);
    this.name = "JoybuyApiNotImplementedError";
  }
}

/**
 * Typed Joybuy API / HTTP failure.
 * Never include appSecret, accessToken, or signature material in message/details.
 */
export class JoybuyApiError extends JoybuyError {
  readonly httpStatus: number;
  readonly joybuyCode: string | null;
  readonly details: string | null;
  readonly requestId: string | null;
  readonly errorList: JoybuyApiErrorItem[];

  constructor(input: {
    message: string;
    httpStatus: number;
    joybuyCode?: string | null;
    details?: string | null;
    requestId?: string | null;
    errorList?: JoybuyApiErrorItem[];
  }) {
    super("JOYBUY_API_ERROR", input.message);
    this.name = "JoybuyApiError";
    this.httpStatus = input.httpStatus;
    this.joybuyCode = input.joybuyCode ?? null;
    this.details = input.details ?? null;
    this.requestId = input.requestId ?? null;
    this.errorList = input.errorList ?? [];
  }
}

export function toJoybuyFailure(error: unknown): {
  success: false;
  code: JoybuyErrorCode;
  message: string;
} {
  if (error instanceof JoybuyError) {
    return { success: false, code: error.code, message: error.message };
  }
  return {
    success: false,
    code: "JOYBUY_SYNC_BLOCKED",
    message: "Joybuy operation could not be completed.",
  };
}
