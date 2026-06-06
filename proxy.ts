import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE, readSessionCookieValue } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname) || isPublicApi(pathname)) return NextResponse.next();

  const session = await readSessionCookieValue(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

