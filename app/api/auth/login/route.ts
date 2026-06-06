import { NextResponse } from "next/server";
import {
  AUTH_STATE_COOKIE,
  adminEmail,
  authCallbackUrl,
  authSecret,
  createStateCookieValue,
  googleAuthClientId,
  googleAuthClientSecret,
  stateCookieMaxAge,
} from "@/lib/auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const AUTH_SCOPES = ["openid", "email", "profile"];

function randomState() {
  const values = new Uint8Array(24);
  crypto.getRandomValues(values);
  let binary = "";
  values.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const clientId = googleAuthClientId();
  if (!authSecret() || !adminEmail() || !clientId || !googleAuthClientSecret()) {
    return NextResponse.redirect(new URL("/login?error=missing_config", request.url));
  }

  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const state = randomState();
  const signedState = await createStateCookieValue(JSON.stringify({ state, next }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: authCallbackUrl(request.url),
    response_type: "code",
    scope: AUTH_SCOPES.join(" "),
    state,
    prompt: "select_account",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  response.cookies.set(AUTH_STATE_COOKIE, signedState, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: stateCookieMaxAge(),
  });
  return response;
}
