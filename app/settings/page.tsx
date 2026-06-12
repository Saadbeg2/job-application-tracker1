"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type GmailStatus = {
  connected: boolean;
  providerAccountEmail: string | null;
  connectedAt: string | null;
  lastScanAt: string | null;
  scanWindowDays: number;
  missingSheetsScope?: boolean;
};

type ScanHistory = {
  id: number;
  scanStartedAt: string;
  scanEndedAt: string;
  resultCount: number;
  createdReviewItemsCount: number;
};

type SheetsStatus = {
  connected: boolean;
  googleConnected: boolean;
  missingScope: boolean;
  envConfigured?: boolean;
  message?: string | null;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
};

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [sheetsStatus, setSheetsStatus] = useState<SheetsStatus | null>(null);
  const [message, setMessage] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function load() {
    const [statusRes, historyRes, sheetsRes] = await Promise.all([
      fetch("/api/gmail/status", { cache: "no-store" }),
      fetch("/api/gmail/scan-history", { cache: "no-store" }),
      fetch("/api/google-sheets/status", { cache: "no-store" }),
    ]);

    if (statusRes.ok) {
      const data = await readJsonSafe<GmailStatus>(statusRes);
      if (data) setStatus(data);
    }
    if (historyRes.ok) {
      const data = await readJsonSafe<ScanHistory[]>(historyRes);
      if (data) setHistory(data);
    }
    if (sheetsRes.ok) {
      const data = await readJsonSafe<SheetsStatus>(sheetsRes);
      if (data) setSheetsStatus(data);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const [statusRes, historyRes, sheetsRes] = await Promise.all([
        fetch("/api/gmail/status", { cache: "no-store" }),
        fetch("/api/gmail/scan-history", { cache: "no-store" }),
        fetch("/api/google-sheets/status", { cache: "no-store" }),
      ]);
      if (!active) return;

      if (statusRes.ok) {
        const data = await readJsonSafe<GmailStatus>(statusRes);
        if (data) setStatus(data);
      }
      if (historyRes.ok) {
        const data = await readJsonSafe<ScanHistory[]>(historyRes);
        if (data) setHistory(data);
      }
      if (sheetsRes.ok) {
        const data = await readJsonSafe<SheetsStatus>(sheetsRes);
        if (data) setSheetsStatus(data);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function callAction(key: string, url: string, init?: RequestInit) {
    setLoading(key);
    setMessage("");
    try {
      const response = await fetch(url, init);
      const data = await readJsonSafe<{ error?: string; spreadsheetUrl?: string; applicationsSynced?: number; tasksSynced?: number }>(response);
      if (!response.ok) {
        setMessage(data?.error ?? "Request failed.");
        return;
      }
      if (key === "sync") {
        setMessage(
          `Google Sheet synced. Applications: ${data?.applicationsSynced ?? 0}, Tasks: ${data?.tasksSynced ?? 0}.`,
        );
      } else if (key === "connect") {
        setMessage("Existing tracker sheet connected successfully.");
      } else if (key === "disconnect-sheet") {
        setMessage("Google Sheet disconnected from app.");
      } else if (key === "disconnect-gmail") {
        setMessage("Google account disconnected.");
      }
      await load();
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Settings</h2>

      <div className="card stack">
        <h3>Google Connection</h3>
        <p><strong>Status:</strong> {status?.connected ? "Connected" : "Not connected"}</p>
        <p><strong>Account:</strong> {status?.providerAccountEmail ?? "-"}</p>
        <p><strong>Last Gmail scan:</strong> {status?.lastScanAt ? new Date(status.lastScanAt).toLocaleString() : "Never"}</p>
        <p><strong>Scan window:</strong> Last {status?.scanWindowDays ?? 7} days</p>
        {status?.missingSheetsScope ? (
          <p className="error">Google Sheets permission is missing. Reconnect Google to enable Sheets sync.</p>
        ) : null}

        <div className="actions">
          <a className="primary" href="/api/gmail/connect">Connect/Reconnect Google</a>
          <button
            className="secondary"
            type="button"
            disabled={loading === "disconnect-gmail"}
            onClick={() => void callAction("disconnect-gmail", "/api/gmail/disconnect", { method: "POST" })}
          >
            Disconnect Google
          </button>
          <Link className="secondary" href="/review">
            Go to Review Queue
          </Link>
        </div>
      </div>

      <div className="card stack">
        <h3>Google Sheets Sync</h3>
        <p><strong>Sheet Configured:</strong> {sheetsStatus?.spreadsheetId ? "Yes" : "No"}</p>
        <p><strong>Spreadsheet ID:</strong> {sheetsStatus?.spreadsheetId ?? "-"}</p>
        <p><strong>Last Synced:</strong> {sheetsStatus?.lastSyncedAt ? new Date(sheetsStatus.lastSyncedAt).toLocaleString() : "Never"}</p>
        <p><strong>Last Sync Status:</strong> {sheetsStatus?.lastSyncStatus ?? "-"}</p>
        {sheetsStatus?.lastSyncError ? <p className="error">Last sync error: {sheetsStatus.lastSyncError}</p> : null}
        {sheetsStatus?.message ? <p className="error">{sheetsStatus.message}</p> : null}
        {sheetsStatus?.missingScope ? (
          <p className="error">Google Sheets permission is missing. Reconnect Google to continue.</p>
        ) : null}

        <div className="actions">
          <button
            className="secondary"
            type="button"
            disabled={loading === "sync"}
            onClick={() => void callAction("sync", "/api/google-sheets/sync", { method: "POST" })}
          >
            Re-sync Google Sheet
          </button>
          <button
            className="danger"
            type="button"
            disabled={loading === "disconnect-sheet"}
            onClick={() => void callAction("disconnect-sheet", "/api/google-sheets/disconnect", { method: "POST" })}
          >
            Disconnect Sheet
          </button>
          {sheetsStatus?.spreadsheetUrl ? (
            <a className="secondary" href={sheetsStatus.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
              Open Google Sheet
            </a>
          ) : null}
        </div>

        <div className="form-grid">
          <label>
            Connect Existing Spreadsheet ID/URL (Advanced Fallback)
            <input
              value={sheetInput}
              onChange={(event) => setSheetInput(event.target.value)}
              placeholder="Spreadsheet ID or full URL"
            />
          </label>
        </div>
        <div className="actions">
          <button
            className="secondary"
            type="button"
            disabled={loading === "connect"}
            onClick={() =>
              void callAction("connect", "/api/google-sheets/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId: sheetInput }),
              })
            }
          >
            Connect Existing Sheet
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3>Recent Gmail Scan History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Ended</th>
                <th>Messages Scanned</th>
                <th>Review Items Created</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.scanStartedAt).toLocaleString()}</td>
                  <td>{new Date(item.scanEndedAt).toLocaleString()}</td>
                  <td>{item.resultCount}</td>
                  <td>{item.createdReviewItemsCount}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">No scans yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {message ? <p className={message.toLowerCase().includes("failed") || message.toLowerCase().includes("missing") || message.toLowerCase().includes("error") ? "error" : "muted"}>{message}</p> : null}
    </section>
  );
}
