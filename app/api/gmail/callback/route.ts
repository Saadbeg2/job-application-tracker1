import { exchangeCodeForTokens, fetchGoogleProfile } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?gmail=error&reason=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?gmail=error&reason=missing_code", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchGoogleProfile(tokens.access_token);
    const expiryDate = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    const existing = await prisma.gmailConnection.findFirst({ orderBy: { updatedAt: "desc" } });

    // TODO: Encrypt tokens at rest for production. This local MVP stores them in SQLite.
    if (existing) {
      await prisma.gmailConnection.update({
        where: { id: existing.id },
        data: {
          providerAccountEmail: email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existing.refreshToken,
          expiryDate,
          grantedScopes: tokens.scope ?? existing.grantedScopes,
        },
      });
    } else {
      await prisma.gmailConnection.create({
        data: {
          providerAccountEmail: email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiryDate,
          grantedScopes: tokens.scope ?? null,
        },
      });
    }

    return NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?gmail=error&reason=oauth_exchange_failed", request.url));
  }
}
