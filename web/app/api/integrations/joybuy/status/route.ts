import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getJoybuyAdminStatus } from "@/lib/integrations/joybuy/status";

export const GET = staffRoute(async () => {
  const status = getJoybuyAdminStatus();
  return NextResponse.json({ success: true, status });
});
