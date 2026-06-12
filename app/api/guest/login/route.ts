import {
  GUEST_SESSION_COOKIE,
  createGuestSessionCookieValue,
  guestSessionCookieMaxAge,
  isValidGuestAccessCode,
} from "@/lib/auth";
import { NextResponse } from "next/server";

async function readAccessCode(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { accessCode?: string } | null;
    return String(body?.accessCode ?? "");
  }

  const form = await request.formData();
  return String(form.get("accessCode") ?? "");
}

export async function POST(request: Request) {
  const accessCode = await readAccessCode(request);

  if (!isValidGuestAccessCode(accessCode)) {
    const response = NextResponse.redirect(new URL("/?guest=invalid", request.url));
    response.cookies.delete(GUEST_SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(GUEST_SESSION_COOKIE, await createGuestSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: guestSessionCookieMaxAge(),
  });
  return response;
}
