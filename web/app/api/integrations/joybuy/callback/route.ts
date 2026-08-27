import { NextResponse } from "next/server";
import { joybuyLog } from "@/lib/integrations/joybuy/log";

/**
 * Joybuy OAuth / callback placeholder.
 *
 * Registered URL (eventually):
 *   https://<THOMAS_OS_DOMAIN>/api/integrations/joybuy/callback
 *
 * Does not assume a Joybuy payload schema, does not persist request bodies,
 * and does not log secrets. Real protocol will be implemented after official docs.
 */

export const runtime = "nodejs";

function controlledResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "JOYBUY_NOT_CONFIGURED",
      message:
        "Joybuy callback integration is not configured yet. The Joybuy application is Pending Review and the official callback protocol has not been wired.",
    },
    { status: 501 },
  );
}

export async function GET(request: Request) {
  joybuyLog({
    operation: "callback",
    level: "info",
    message: "Joybuy callback GET received (not configured)",
    httpStatus: 501,
  });
  void request.url;
  return controlledResponse();
}

export async function POST(request: Request) {
  // Intentionally do not read or store the body — avoid logging secrets / codes.
  void request;
  joybuyLog({
    operation: "callback",
    level: "info",
    message: "Joybuy callback POST received (not configured)",
    httpStatus: 501,
  });
  return controlledResponse();
}
