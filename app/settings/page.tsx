"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type GmailStatus = {
  connected: boolean;
  providerAccountEmail: string | null;
  connectedAt: string | null;
  lastScanAt: string | null;
  scanWindowDays: number;
};

type ScanHistory = {
  id: number;
  scanStartedAt: string;
  scanEndedAt: string;
  resultCount: number;
  createdReviewItemsCount: number;
};

export default function SettingsPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const [statusRes, historyRes] = await Promise.all([
      fetch("/api/gmail/status", { cache: "no-store" }),
      fetch("/api/gmail/scan-history", { cache: "no-store" }),
    ]);

    if (statusRes.ok) {
      setStatus((await statusRes.json()) as GmailStatus);
    }
    if (historyRes.ok) {
      setHistory((await historyRes.json()) as ScanHistory[]);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const [statusRes, historyRes] = await Promise.all([
        fetch("/api/gmail/status", { cache: "no-store" }),
        fetch("/api/gmail/scan-history", { cache: "no-store" }),
      ]);
      if (!active) return;
      if (statusRes.ok) setStatus((await statusRes.json()) as GmailStatus);
      if (historyRes.ok) setHistory((await historyRes.json()) as ScanHistory[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function disconnect() {
    setMessage("");
    const response = await fetch("/api/gmail/disconnect", { method: "POST" });
    if (!response.ok) {
      setMessage("Failed to disconnect Gmail.");
      return;
    }
    setMessage("Gmail disconnected.");
    await load();
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Settings</h2>

      <div className="card stack">
        <h3>Gmail Connection</h3>
        <p><strong>Status:</strong> {status?.connected ? "Connected" : "Not connected"}</p>
        <p><strong>Account:</strong> {status?.providerAccountEmail ?? "-"}</p>
        <p><strong>Last Gmail scan:</strong> {status?.lastScanAt ? new Date(status.lastScanAt).toLocaleString() : "Never"}</p>
        <p><strong>Scan window:</strong> Last {status?.scanWindowDays ?? 7} days</p>

        <div className="actions">
          <a className="primary" href="/api/gmail/connect">Connect Gmail</a>
          <button className="secondary" type="button" onClick={() => void disconnect()}>
            Disconnect Gmail
          </button>
          <Link className="secondary" href="/review">
            Go to Review Queue
          </Link>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </div>

      <div className="card stack">
        <h3>Recent Scan History</h3>
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
    </section>
  );
}
