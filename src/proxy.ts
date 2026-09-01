import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth is disabled — all requests pass through.
export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/trino|api/collect|api/auth|_next/static|_next/image|favicon\\.ico|apple-icon\\.png|icon\\.png).*)",
  ],
};
