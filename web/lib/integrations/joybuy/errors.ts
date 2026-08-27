import type { JoybuyErrorCode } from "./types";

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
