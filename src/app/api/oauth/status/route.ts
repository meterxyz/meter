import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const status = await getConnectionStatus(userId);
  return NextResponse.json(status);
}
