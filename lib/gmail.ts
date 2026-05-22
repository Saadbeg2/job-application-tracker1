import { PrismaClient, ReviewItemType } from "@prisma/client";
import { gmailScanQuery } from "@/lib/gmailClassifier";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function scanDays() {
  const value = Number(process.env.GMAIL_SCAN_DAYS ?? "7");
  return Number.isFinite(value) && value > 0 ? value : 7;
}

export function buildConnectUrl() {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${GMAIL_SCOPE} ${SHEETS_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export async function exchangeCodeForTokens(code: string) {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange OAuth code");
  }

  const tokens = (await response.json()) as TokenResponse;
  return tokens;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  return (await response.json()) as TokenResponse;
}

export async function getValidAccessToken(prisma: PrismaClient) {
  const connection = await prisma.gmailConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!connection) {
    throw new Error("GMAIL_NOT_CONNECTED");
  }

  const expiresAt = connection.expiryDate?.getTime() ?? 0;
  const isExpired = expiresAt > 0 && expiresAt < Date.now() + 30_000;

  if (!isExpired) {
    return { accessToken: connection.accessToken, connectionId: connection.id };
  }

  if (!connection.refreshToken) {
    throw new Error("GMAIL_TOKEN_EXPIRED");
  }

  const refreshed = await refreshAccessToken(connection.refreshToken);
  const newExpiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;

  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      expiryDate: newExpiry,
    },
  });

  return { accessToken: refreshed.access_token, connectionId: connection.id };
}

export function hasSheetsScope(scopes: string | null | undefined) {
  if (!scopes) return false;
  return scopes.split(/\s+/).includes(SHEETS_SCOPE);
}

type GmailMessageListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

export async function listJobRelatedMessageIds(accessToken: string) {
  const days = scanDays();
  const query = gmailScanQuery.replace("newer_than:7d", `newer_than:${days}d`);
  const response = await fetch(
    `${GMAIL_API_BASE}/messages?maxResults=100&q=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to list Gmail messages");
  }

  const data = (await response.json()) as GmailMessageListResponse;
  return data.messages ?? [];
}

export async function fetchMessageMetadata(accessToken: string, messageId: string) {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch message metadata for ${messageId}`);
  }

  const data = (await response.json()) as GmailMessageResponse;
  const headers = data.payload?.headers ?? [];

  const sender = headers.find((header) => header.name.toLowerCase() === "from")?.value ?? "";
  const subject = headers.find((header) => header.name.toLowerCase() === "subject")?.value ?? "";
  const dateHeader = headers.find((header) => header.name.toLowerCase() === "date")?.value ?? "";

  return {
    gmailMessageId: data.id,
    threadId: data.threadId,
    sender,
    subject,
    snippet: data.snippet ?? "",
    receivedAt: data.internalDate ? new Date(Number(data.internalDate)) : dateHeader ? new Date(dateHeader) : null,
  };
}

export function scanWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - scanDays());
  return { start, end };
}

export const GMAIL_READONLY_SCOPE = GMAIL_SCOPE;
export const GOOGLE_SHEETS_SCOPE = SHEETS_SCOPE;

export function mapDetectedType(type: ReviewItemType) {
  return type;
}
