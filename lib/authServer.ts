import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE, readSessionCookieValue } from "@/lib/auth";

export async function getAdminSession() {
  const cookieStore = await cookies();
  return readSessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
}

