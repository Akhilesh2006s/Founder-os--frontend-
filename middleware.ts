import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * HttpOnly auth cookies are set on the API host (e.g. Railway), not on the Next.js host (Vercel).
 * Edge middleware only sees cookies on the page origin, so cookie-based redirects would always
 * block `/dashboard` after a successful cross-origin login. Session is enforced in the client:
 * `AuthProvider` (GET /auth/me) and `(protected)/layout.tsx`.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    return NextResponse.rewrite(new URL("/icon", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/action-items/:path*",
    "/completed-items/:path*",
    "/calendar/:path*",
    "/sales/:path*",
    "/clients",
    "/clients/:path*",
    "/expenses/:path*",
    "/finance/:path*",
    "/employees/:path*",
    "/operations/:path*",
    "/meetings/:path*",
    "/visitors/:path*",
    "/notifications/:path*",
    "/documents/:path*",
    "/activity-log",
    "/activity-log/:path*",
    "/login",
    "/signup",
    "/favicon.ico"
  ]
};
