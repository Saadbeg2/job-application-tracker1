import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  GUEST_SESSION_COOKIE,
  readGuestSessionCookieValue,
  readSessionCookieValue,
} from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login"];
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/guest/login", "/api/guest/logout"];
const GUEST_API_PATHS = ["/api/guest/summary", "/api/guest/company-suggestions"];
const GUEST_PAGE_PATHS = ["/"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isGuestApi(pathname: string) {
  return GUEST_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isGuestPage(pathname: string) {
  return GUEST_PAGE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function redirectToGuestHome(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname) || isPublicApi(pathname)) return NextResponse.next();

  const adminSession = await readSessionCookieValue(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (adminSession) return NextResponse.next();

  const guestSession = await readGuestSessionCookieValue(request.cookies.get(GUEST_SESSION_COOKIE)?.value);
  if (guestSession && (isGuestPage(pathname) || isGuestApi(pathname))) return NextResponse.next();

  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return redirectToGuestHome(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
