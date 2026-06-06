import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, AUTH_STATE_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(AUTH_SESSION_COOKIE);
  response.cookies.delete(AUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(AUTH_SESSION_COOKIE);
  response.cookies.delete(AUTH_STATE_COOKIE);
  return response;
}

