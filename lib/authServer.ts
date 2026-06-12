import { cookies } from "next/headers";
import {
  AUTH_SESSION_COOKIE,
  GUEST_SESSION_COOKIE,
  readGuestSessionCookieValue,
  readSessionCookieValue,
} from "@/lib/auth";

export async function getAdminSession() {
  const cookieStore = await cookies();
  return readSessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
}

export async function getGuestSession() {
  const cookieStore = await cookies();
  return readGuestSessionCookieValue(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
}

export async function getAdminOrGuestSession() {
  const cookieStore = await cookies();
  const adminSession = await readSessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  if (adminSession) return { role: "admin" as const, session: adminSession };

  const guestSession = await readGuestSessionCookieValue(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (guestSession) return { role: "guest" as const, session: guestSession };

  return null;
}
