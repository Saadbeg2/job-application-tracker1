import { GUEST_SESSION_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(GUEST_SESSION_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(GUEST_SESSION_COOKIE);
  return response;
}
