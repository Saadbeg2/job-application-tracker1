import { Application, PrismaClient, Task } from "@prisma/client";
import { GOOGLE_SHEETS_SCOPE, getValidAccessToken, hasSheetsScope } from "@/lib/gmail";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_TITLE = process.env.GOOGLE_SHEETS_DEFAULT_TITLE || "Job Application Tracker";
const ENV_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || "";
const ENV_SPREADSHEET_URL = process.env.GOOGLE_SHEETS_SPREADSHEET_URL?.trim() || "";

const APPLICATION_HEADERS = [
  "Date Applied",
  "Company",
  "Role",
  "Status",
  "Source",
  "Job Link",
  "Resume Used",
  "Location",
  "Referral",
  "Notes",
  "Created At",
  "Last Updated",
];

const TASK_HEADERS = [
  "Date Found",
  "Company",
  "Role",
  "Task",
  "Task Status",
  "Due Date",
  "Source Email Subject",
  "Notes",
  "Created At",
  "Last Updated",
];

function formatDateOnly(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString();
}

function cleanCell(value: string | null | undefined) {
  return value ?? "";
}

export function parseSpreadsheetInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const idFromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  return idFromUrl ?? trimmed;
}

function sheetUrlFromId(spreadsheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

async function configuredSheet(prisma: PrismaClient) {
  if (ENV_SPREADSHEET_ID) {
    return {
      spreadsheetId: ENV_SPREADSHEET_ID,
      spreadsheetUrl: ENV_SPREADSHEET_URL || sheetUrlFromId(ENV_SPREADSHEET_ID),
      applicationsSheetName: "Applications",
      tasksSheetName: "Tasks",
      fromEnv: true,
    };
  }

  const dbSheet = await prisma.googleSheetSync.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!dbSheet) return null;
  return {
    spreadsheetId: dbSheet.spreadsheetId,
    spreadsheetUrl: dbSheet.spreadsheetUrl,
    applicationsSheetName: dbSheet.applicationsSheetName,
    tasksSheetName: dbSheet.tasksSheetName,
    fromEnv: false,
    dbId: dbSheet.id,
  };
}

function friendlyGoogleApiError(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes("service_disabled") || lower.includes("accessnotconfigured")) {
    return "Google Sheets API is disabled for this Google Cloud project. Enable Google Sheets API in Google Cloud Console, wait a few minutes, then try again.";
  }
  if (lower.includes("insufficient authentication scopes")) {
    return "Google Sheets permission is missing. Reconnect Google and grant Sheets access.";
  }

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
    };
    const message = parsed.error?.message?.trim();
    if (message) return message;
  } catch {
    // Ignore parse errors and fall back.
  }

  return "Google Sheets API request failed.";
}

async function sheetsFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const safeMessage = friendlyGoogleApiError(text || "");
    // Safe server-side logging for debugging; do not log tokens.
    console.error("[google-sheets] API request failed", {
      status: response.status,
      statusText: response.statusText,
      endpoint: path,
      errorPreview: (text || "").slice(0, 300),
    });
    throw new Error(safeMessage);
  }

  return (await response.json()) as T;
}

async function ensureSheetsScope(prisma: PrismaClient) {
  const connection = await prisma.gmailConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!connection) throw new Error("GOOGLE_NOT_CONNECTED");
  if (!hasSheetsScope(connection.grantedScopes)) throw new Error("MISSING_SHEETS_SCOPE");
}

export async function createTrackerSpreadsheet(prisma: PrismaClient) {
  await ensureSheetsScope(prisma);
  const { accessToken } = await getValidAccessToken(prisma);

  const created = await sheetsFetch<{ spreadsheetId: string; spreadsheetUrl: string }>(
    accessToken,
    SHEETS_API,
    {
      method: "POST",
      body: JSON.stringify({
        properties: { title: DEFAULT_TITLE },
        sheets: [
          { properties: { title: "Applications" } },
          { properties: { title: "Tasks" } },
        ],
      }),
    },
  );

  const existing = await prisma.googleSheetSync.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) {
    return prisma.googleSheetSync.update({
      where: { id: existing.id },
      data: {
        spreadsheetId: created.spreadsheetId,
        spreadsheetUrl: created.spreadsheetUrl,
        applicationsSheetName: "Applications",
        tasksSheetName: "Tasks",
        lastSyncStatus: null,
        lastSyncError: null,
      },
    });
  }

  return prisma.googleSheetSync.create({
    data: {
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl,
      applicationsSheetName: "Applications",
      tasksSheetName: "Tasks",
    },
  });
}

export async function connectExistingSpreadsheet(prisma: PrismaClient, spreadsheetId: string) {
  await ensureSheetsScope(prisma);
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  const existing = await prisma.googleSheetSync.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) {
    return prisma.googleSheetSync.update({
      where: { id: existing.id },
      data: {
        spreadsheetId,
        spreadsheetUrl: url,
        applicationsSheetName: "Applications",
        tasksSheetName: "Tasks",
      },
    });
  }

  return prisma.googleSheetSync.create({
    data: {
      spreadsheetId,
      spreadsheetUrl: url,
      applicationsSheetName: "Applications",
      tasksSheetName: "Tasks",
    },
  });
}

async function ensureSheetTabs(accessToken: string, spreadsheetId: string, tabNames: string[]) {
  const meta = await sheetsFetch<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    accessToken,
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
  );

  const existingTitles = new Set((meta.sheets ?? []).map((s) => s.properties?.title).filter(Boolean));
  const addRequests = tabNames
    .filter((name) => !existingTitles.has(name))
    .map((name) => ({ addSheet: { properties: { title: name } } }));

  if (addRequests.length === 0) return;

  await sheetsFetch(accessToken, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: addRequests }),
  });
}

async function clearAndWriteTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  headers: string[],
  rows: string[][],
) {
  await sheetsFetch(accessToken, `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tabName)}:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  await sheetsFetch(accessToken, `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=RAW&insertDataOption=OVERWRITE`, {
    method: "POST",
    body: JSON.stringify({ values: [headers, ...rows] }),
  });
}

function applicationRows(applications: Application[]) {
  return applications.map((a) => [
    formatDateOnly(a.dateApplied),
    cleanCell(a.company),
    cleanCell(a.role),
    cleanCell(a.status),
    cleanCell(a.source),
    cleanCell(a.jobLink),
    cleanCell(a.resumeUsed),
    cleanCell(a.location),
    cleanCell(a.referral),
    cleanCell(a.notes),
    formatDateTime(a.createdAt),
    formatDateTime(a.updatedAt),
  ]);
}

function taskRows(tasks: Task[]) {
  return tasks.map((t) => [
    formatDateOnly(t.createdAt),
    cleanCell(t.company),
    cleanCell(t.role),
    cleanCell(t.title),
    cleanCell(t.status),
    formatDateOnly(t.dueDate),
    cleanCell(t.sourceEmailSubject),
    cleanCell(t.notes),
    formatDateTime(t.createdAt),
    formatDateTime(t.updatedAt),
  ]);
}

export async function syncSpreadsheet(prisma: PrismaClient) {
  await ensureSheetsScope(prisma);
  const syncConfig = await configuredSheet(prisma);
  if (!syncConfig) throw new Error("SHEET_NOT_CONFIGURED");

  const { accessToken } = await getValidAccessToken(prisma);

  const [applications, tasks] = await Promise.all([
    prisma.application.findMany({
      orderBy: [{ dateApplied: "desc" }, { createdAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.task.findMany({
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  try {
    await ensureSheetTabs(accessToken, syncConfig.spreadsheetId, [
      syncConfig.applicationsSheetName,
      syncConfig.tasksSheetName,
    ]);

    await clearAndWriteTab(
      accessToken,
      syncConfig.spreadsheetId,
      syncConfig.applicationsSheetName,
      APPLICATION_HEADERS,
      applicationRows(applications),
    );

    await clearAndWriteTab(
      accessToken,
      syncConfig.spreadsheetId,
      syncConfig.tasksSheetName,
      TASK_HEADERS,
      taskRows(tasks),
    );

    const lastSyncedAt = new Date();
    if (!syncConfig.fromEnv && syncConfig.dbId) {
      await prisma.googleSheetSync.update({
        where: { id: syncConfig.dbId },
        data: {
          lastSyncedAt,
          lastSyncStatus: "success",
          lastSyncError: null,
        },
      });
    }

    return {
      ok: true,
      applicationsSynced: applications.length,
      tasksSynced: tasks.length,
      spreadsheetUrl: syncConfig.spreadsheetUrl,
      lastSyncedAt: lastSyncedAt.toISOString(),
    };
  } catch (error) {
    if (!syncConfig.fromEnv && syncConfig.dbId) {
      await prisma.googleSheetSync.update({
        where: { id: syncConfig.dbId },
        data: {
          lastSyncStatus: "error",
          lastSyncError: error instanceof Error ? error.message : "Unknown sync error",
        },
      });
    }
    throw error;
  }
}

export async function disconnectSpreadsheet(prisma: PrismaClient) {
  await prisma.googleSheetSync.deleteMany();
  return { disconnected: true };
}

export async function sheetsStatus(prisma: PrismaClient) {
  const connection = await prisma.gmailConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  const sync = await prisma.googleSheetSync.findFirst({ orderBy: { updatedAt: "desc" } });
  const envConfigured = Boolean(ENV_SPREADSHEET_ID);
  const spreadsheetId = envConfigured ? ENV_SPREADSHEET_ID : sync?.spreadsheetId;
  const spreadsheetUrl = envConfigured
    ? ENV_SPREADSHEET_URL || sheetUrlFromId(ENV_SPREADSHEET_ID)
    : sync?.spreadsheetUrl;

  const googleConnected = Boolean(connection);
  const missingScope = googleConnected ? !hasSheetsScope(connection?.grantedScopes) : false;

  return {
    connected: googleConnected,
    googleConnected,
    missingScope,
    spreadsheetId: spreadsheetId ?? null,
    spreadsheetUrl: spreadsheetUrl ?? null,
    envConfigured,
    lastSyncedAt: sync?.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: sync?.lastSyncStatus ?? null,
    lastSyncError: sync?.lastSyncError ?? null,
    requiredScope: GOOGLE_SHEETS_SCOPE,
  };
}
