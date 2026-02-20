import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

/**
 * Verify the request is from an authenticated user via session cookie.
 * Returns the userId if valid, or a 401 NextResponse if not.
 */
export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId };
}
