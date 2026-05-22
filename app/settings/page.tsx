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

type ReportRecipient = {
  id: number;
  name: string;
  email: string;
  timezone: "Asia/Karachi" | "America/Chicago" | "Europe/London";
  active: boolean;
};

type ReportSendLog = {
  id: number;
  reportDate: string;
  timezone: string;
  sentAt: string;
  status: "sent" | "failed";
  errorMessage: string | null;
  recipient: {
    name: string;
    email: string;
    timezone: string;
  };
};

const timezoneOptions = ["Asia/Karachi", "America/Chicago", "Europe/London"] as const;

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
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [sendLogs, setSendLogs] = useState<ReportSendLog[]>([]);
  const [message, setMessage] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [recipientForm, setRecipientForm] = useState({
    name: "",
    email: "",
    timezone: "America/Chicago" as ReportRecipient["timezone"],
    active: true,
  });

  async function load() {
    const [statusRes, historyRes, sheetsRes, recipientsRes, logsRes] = await Promise.all([
      fetch("/api/gmail/status", { cache: "no-store" }),
      fetch("/api/gmail/scan-history", { cache: "no-store" }),
      fetch("/api/google-sheets/status", { cache: "no-store" }),
      fetch("/api/report-recipients", { cache: "no-store" }),
      fetch("/api/reports/send-log", { cache: "no-store" }),
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
    if (recipientsRes.ok) {
      const data = await readJsonSafe<ReportRecipient[]>(recipientsRes);
      if (data) setRecipients(data);
    }
    if (logsRes.ok) {
      const data = await readJsonSafe<ReportSendLog[]>(logsRes);
      if (data) setSendLogs(data);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const [statusRes, historyRes, sheetsRes, recipientsRes, logsRes] = await Promise.all([
        fetch("/api/gmail/status", { cache: "no-store" }),
        fetch("/api/gmail/scan-history", { cache: "no-store" }),
        fetch("/api/google-sheets/status", { cache: "no-store" }),
        fetch("/api/report-recipients", { cache: "no-store" }),
        fetch("/api/reports/send-log", { cache: "no-store" }),
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
      if (recipientsRes.ok) {
        const data = await readJsonSafe<ReportRecipient[]>(recipientsRes);
        if (data) setRecipients(data);
      }
      if (logsRes.ok) {
        const data = await readJsonSafe<ReportSendLog[]>(logsRes);
        if (data) setSendLogs(data);
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
      } else if (key === "send-test") {
        setMessage("Test report request completed.");
      } else if (key === "send-due") {
        setMessage("Send-due request completed.");
      }
      await load();
    } finally {
      setLoading(null);
    }
  }

  async function addRecipient() {
    setLoading("add-recipient");
    setMessage("");
    try {
      const response = await fetch("/api/report-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipientForm),
      });
      const data = await readJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        setMessage(data?.error ?? "Failed to add recipient");
        return;
      }
      setRecipientForm({ name: "", email: "", timezone: "America/Chicago", active: true });
      setMessage("Recipient added.");
      await load();
    } finally {
      setLoading(null);
    }
  }

  async function updateRecipient(recipient: ReportRecipient, patch: Partial<ReportRecipient>) {
    const response = await fetch(`/api/report-recipients/${recipient.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...recipient, ...patch }),
    });
    if (!response.ok) {
      const data = await readJsonSafe<{ error?: string }>(response);
      setMessage(data?.error ?? "Failed to update recipient");
      return;
    }
    await load();
  }

  async function deleteRecipient(id: number) {
    const confirmed = window.confirm("Delete this recipient?");
    if (!confirmed) return;

    const response = await fetch(`/api/report-recipients/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await readJsonSafe<{ error?: string }>(response);
      setMessage(data?.error ?? "Failed to delete recipient");
      return;
    }

    setMessage("Recipient deleted.");
    await load();
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
        <h3>Daily Reports</h3>
        <p className="muted">Reports send at 5:00 PM in each recipient’s local timezone.</p>

        <div className="form-grid">
          <label>
            Name
            <input value={recipientForm.name} onChange={(e) => setRecipientForm((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label>
            Email
            <input value={recipientForm.email} onChange={(e) => setRecipientForm((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label>
            Timezone
            <select
              value={recipientForm.timezone}
              onChange={(e) =>
                setRecipientForm((p) => ({ ...p, timezone: e.target.value as ReportRecipient["timezone"] }))
              }
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label>
            Active
            <select
              value={recipientForm.active ? "yes" : "no"}
              onChange={(e) => setRecipientForm((p) => ({ ...p, active: e.target.value === "yes" }))}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="primary" type="button" disabled={loading === "add-recipient"} onClick={() => void addRecipient()}>
            Add Recipient
          </button>
          <button
            className="secondary"
            type="button"
            disabled={loading === "send-test"}
            onClick={() => void callAction("send-test", "/api/reports/send-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) })}
          >
            Send Test Report (All Active)
          </button>
          <button
            className="secondary"
            type="button"
            disabled={loading === "send-due"}
            onClick={() => void callAction("send-due", "/api/reports/send-due?force=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) })}
          >
            Send Due Now (Force)
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Timezone</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td>{recipient.name}</td>
                  <td>{recipient.email}</td>
                  <td>{recipient.timezone}</td>
                  <td>{recipient.active ? "Yes" : "No"}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void updateRecipient(recipient, { active: !recipient.active })}
                      >
                        {recipient.active ? "Deactivate" : "Activate"}
                      </button>
                      <button className="danger" type="button" onClick={() => void deleteRecipient(recipient.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">No recipients yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <h4>Recent Send Log</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Recipient</th>
                <th>Timezone</th>
                <th>Report Date</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {sendLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.sentAt).toLocaleString()}</td>
                  <td>{log.recipient.email}</td>
                  <td>{log.timezone}</td>
                  <td>{log.reportDate}</td>
                  <td>{log.status}</td>
                  <td>{log.errorMessage ?? "-"}</td>
                </tr>
              ))}
              {sendLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">No report sends yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
