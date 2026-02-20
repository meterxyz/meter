import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!userId || !workspaceId) {
    return NextResponse.json({ error: "Missing userId or workspaceId" }, { status: 400 });
  }

  const status = await getConnectionStatus(userId, workspaceId);
  return NextResponse.json(status);
}
