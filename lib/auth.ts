export const AUTH_SESSION_COOKIE = "jat_admin_session";
export const AUTH_STATE_COOKIE = "jat_auth_state";
export const GUEST_SESSION_COOKIE = "jat_guest_session";
export const DEMO_ADMIN_SESSION_COOKIE = "jat_demo_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const STATE_TTL_SECONDS = 60 * 10;

type AdminSession = {
  email: string;
  exp: number;
};

type GuestSession = {
  role: "guest";
  exp: number;
};

type DemoAdminSession = {
  role: "demo_admin";
  exp: number;
};

type SignedPayload = {
  payload: string;
  signature: string;
};

function textEncoder() {
  return new TextEncoder();
}

function base64UrlEncode(value: string) {
  const bytes = textEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export function authBaseUrl(requestUrl?: string) {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (requestUrl) return new URL(requestUrl).origin;
  return "http://localhost:3000";
}

export function adminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || "";
}

export function guestAccessCode() {
  if (process.env.DEMO_MODE?.trim().toLowerCase() === "true") {
    return process.env.DEMO_GUEST_ACCESS_CODE?.trim() || process.env.GUEST_ACCESS_CODE?.trim() || "";
  }
  return process.env.GUEST_ACCESS_CODE?.trim() || "";
}

function isDemoModeEnabled() {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}

export function googleAuthClientId() {
  return process.env.GOOGLE_AUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
}

export function googleAuthClientSecret() {
  return process.env.GOOGLE_AUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

export function authCallbackUrl(requestUrl?: string) {
  return `${authBaseUrl(requestUrl)}/api/auth/callback`;
}

export function sessionCookieMaxAge() {
  return SESSION_TTL_SECONDS;
}

export function guestSessionCookieMaxAge() {
  return SESSION_TTL_SECONDS;
}

export function stateCookieMaxAge() {
  return STATE_TTL_SECONDS;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder().encode(value));
  const bytes = new Uint8Array(signature);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signPayload(payload: string, secret: string) {
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
}

function splitSignedValue(value: string): SignedPayload | null {
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  return { payload, signature };
}

async function verifySignedValue(value: string, secret: string) {
  const signed = splitSignedValue(value);
  if (!signed) return null;
  const expected = await hmac(signed.payload, secret);
  if (!timingSafeEqual(signed.signature, expected)) return null;
  return signed.payload;
}

export async function createSessionCookieValue(email: string) {
  const secret = authSecret();
  if (!secret) throw new Error("Missing AUTH_SECRET");

  const session: AdminSession = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  return signPayload(base64UrlEncode(JSON.stringify(session)), secret);
}

export async function createGuestSessionCookieValue() {
  const secret = authSecret();
  if (!secret) throw new Error("Missing AUTH_SECRET");

  const session: GuestSession = {
    role: "guest",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  return signPayload(base64UrlEncode(JSON.stringify(session)), secret);
}

export async function createDemoAdminSessionCookieValue() {
  const secret = authSecret();
  if (!secret) throw new Error("Missing AUTH_SECRET");
  if (!isDemoModeEnabled()) throw new Error("DEMO_MODE_REQUIRED");

  const session: DemoAdminSession = {
    role: "demo_admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  return signPayload(base64UrlEncode(JSON.stringify(session)), secret);
}

export async function readSessionCookieValue(value: string | undefined) {
  const secret = authSecret();
  if (!secret || !value) return null;

  const payload = await verifySignedValue(value, secret);
  if (!payload) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AdminSession;
    if (!session.email || !session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    const allowedEmail = adminEmail();
    if (!allowedEmail || session.email !== allowedEmail) return null;
    return session;
  } catch {
    return null;
  }
}

export async function readDemoAdminSessionCookieValue(value: string | undefined) {
  const secret = authSecret();
  if (!isDemoModeEnabled() || !secret || !value) return null;

  const payload = await verifySignedValue(value, secret);
  if (!payload) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as DemoAdminSession;
    if (session.role !== "demo_admin" || !session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function readGuestSessionCookieValue(value: string | undefined) {
  const secret = authSecret();
  if (!secret || !value) return null;

  const payload = await verifySignedValue(value, secret);
  if (!payload) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as GuestSession;
    if (session.role !== "guest" || !session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function isValidGuestAccessCode(value: string) {
  const expected = guestAccessCode();
  const actual = value.trim();
  if (!expected || !actual) return false;
  return timingSafeEqual(actual, expected);
}

export async function createStateCookieValue(state: string) {
  const secret = authSecret();
  if (!secret) throw new Error("Missing AUTH_SECRET");
  return signPayload(base64UrlEncode(state), secret);
}

export async function readStateCookieValue(value: string | undefined) {
  const secret = authSecret();
  if (!secret || !value) return null;
  const payload = await verifySignedValue(value, secret);
  if (!payload) return null;

  try {
    return base64UrlDecode(payload);
  } catch {
    return null;
  }
}
