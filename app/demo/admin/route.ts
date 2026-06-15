import { createDemoAdminSessionCookieValue, DEMO_ADMIN_SESSION_COOKIE, sessionCookieMaxAge } from "@/lib/auth";
import { isDemoMode } from "@/lib/demoMode";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  const cookieValue = await createDemoAdminSessionCookieValue();

  response.cookies.set(DEMO_ADMIN_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionCookieMaxAge(),
  });

  return response;
}
