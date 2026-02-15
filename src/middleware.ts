import { NextRequest, NextResponse } from "next/server";

const DEV_HOSTS = ["dev.getmeter.xyz", "getmeter.dev"];

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  // dev.getmeter.xyz → rewrite to /console
  if (DEV_HOSTS.some((h) => hostname.startsWith(h.split(".")[0]))) {
    if (!pathname.startsWith("/console") && !pathname.startsWith("/api") && !pathname.startsWith("/_next") && !pathname.startsWith("/favicon")) {
      const url = req.nextUrl.clone();
      url.pathname = `/console${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
