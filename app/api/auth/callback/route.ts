import { NextResponse } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  AUTH_STATE_COOKIE,
  adminEmail,
  authCallbackUrl,
  authSecret,
  createSessionCookieValue,
  googleAuthClientId,
  googleAuthClientSecret,
  readStateCookieValue,
  sessionCookieMaxAge,
} from "@/lib/auth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type TokenResponse = {
  access_token?: string;
  id_token?: string;
};

type GoogleProfile = {
  email?: string;
  verified_email?: boolean;
};

function loginRedirect(requestUrl: string, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, requestUrl));
}

function safeNext(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function parseStoredState(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { state?: string; next?: string };
  } catch {
    return null;
  }
}

async function exchangeCode(code: string, requestUrl: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleAuthClientId(),
      client_secret: googleAuthClientSecret(),
      redirect_uri: authCallbackUrl(requestUrl),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) return null;
  return (await response.json()) as TokenResponse;
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  return (await response.json()) as GoogleProfile;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  if (error || !code || !returnedState) return loginRedirect(request.url, "oauth");
  if (!authSecret() || !adminEmail() || !googleAuthClientId() || !googleAuthClientSecret()) {
    return loginRedirect(request.url, "missing_config");
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_STATE_COOKIE}=`))
    ?.split("=")[1];
  const expectedState = parseStoredState(await readStateCookieValue(stateCookie));

  if (!expectedState?.state || expectedState.state !== returnedState) return loginRedirect(request.url, "oauth");

  const tokens = await exchangeCode(code, request.url);
  if (!tokens?.access_token) return loginRedirect(request.url, "oauth");

  const profile = await fetchGoogleProfile(tokens.access_token);
  const email = profile?.email?.trim().toLowerCase();
  if (!email || email !== adminEmail()) return loginRedirect(request.url, "not_admin");

  const response = NextResponse.redirect(new URL(safeNext(expectedState.next), request.url));
  response.cookies.delete(AUTH_STATE_COOKIE);
  response.cookies.set(AUTH_SESSION_COOKIE, await createSessionCookieValue(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionCookieMaxAge(),
  });
  return response;
}
