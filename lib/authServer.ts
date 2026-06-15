import { cookies } from "next/headers";
import {
  AUTH_SESSION_COOKIE,
  DEMO_ADMIN_SESSION_COOKIE,
  GUEST_SESSION_COOKIE,
  readDemoAdminSessionCookieValue,
  readGuestSessionCookieValue,
  readSessionCookieValue,
} from "@/lib/auth";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const adminSession = await readSessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  if (adminSession) return adminSession;

  const demoAdminSession = await readDemoAdminSessionCookieValue(cookieStore.get(DEMO_ADMIN_SESSION_COOKIE)?.value);
  if (demoAdminSession) return { email: "demo-admin@example.invalid", exp: demoAdminSession.exp, demo: true };

  return null;
}

export async function getGuestSession() {
  const cookieStore = await cookies();
  return readGuestSessionCookieValue(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
}

export async function getAdminOrGuestSession() {
  const cookieStore = await cookies();
  const adminSession = await readSessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  if (adminSession) return { role: "admin" as const, session: adminSession };

  const demoAdminSession = await readDemoAdminSessionCookieValue(cookieStore.get(DEMO_ADMIN_SESSION_COOKIE)?.value);
  if (demoAdminSession) return { role: "admin" as const, session: demoAdminSession };

  const guestSession = await readGuestSessionCookieValue(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
  if (guestSession) return { role: "guest" as const, session: guestSession };

  return null;
}
