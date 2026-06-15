"use client";

import Link from "next/link";
import { useState } from "react";

type ActionResponse = {
  ok?: boolean;
  created?: boolean;
  createdReviewItems?: number;
  skipped?: number;
  message?: string;
  error?: string;
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

export default function DemoPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function runAction(key: string, url: string) {
    setLoadingKey(key);
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST" });
      const data = await readJsonSafe<ActionResponse>(response);
      if (!response.ok) {
        setMessage(data?.error ?? "Request failed.");
        return;
      }
      setMessage(data?.message ?? "Done.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Demo Mode</h2>

      <div className="card stack">
        <h3>Demo Controls</h3>
        <p className="muted">
          Use this page to inspect demo helpers. In the full demo environment, prefer running{" "}
          <code>npm run seed:demo</code> against a separate demo database.
        </p>

        <div className="actions">
          <button
            className="primary"
            type="button"
            disabled={loadingKey === "seed-review"}
            onClick={() => void runAction("seed-review", "/api/demo/seed-review-items")}
          >
            Load Demo Review Items
          </button>
          <button
            className="secondary"
            type="button"
            disabled={loadingKey === "seed-existing"}
            onClick={() => void runAction("seed-existing", "/api/demo/seed-existing-application")}
          >
            Load Demo Existing Application
          </button>
          <button
            className="danger"
            type="button"
            disabled={loadingKey === "clear"}
            onClick={() => void runAction("clear", "/api/demo/clear")}
          >
            Clear Demo Data
          </button>
        </div>

        {message ? <p>{message}</p> : null}
      </div>

      <div className="card stack">
        <h3>Walkthrough Checklist</h3>
        <ol className="stack" style={{ gap: "0.5rem", paddingLeft: "1.25rem" }}>
          <li>Seed the demo database with sample-only data</li>
          <li>Go to Review Queue</li>
          <li>Run Demo Gmail Scan to refresh sample ReviewItems</li>
          <li>Approve the Squadron Data LinkedIn application</li>
          <li>Match or backfill the CoreBank interview update</li>
          <li>Review the BrightHealth rejection update</li>
          <li>Check Applications and Tasks pages</li>
          <li>Open the guest dashboard with the demo guest access code</li>
          <li>Confirm Sheets sync and email sending are disabled in demo mode</li>
        </ol>
      </div>

      <div className="card stack">
        <h3>Quick Links</h3>
        <div className="actions">
          <Link className="secondary" href="/review">Review Queue</Link>
          <Link className="secondary" href="/applications">Applications</Link>
          <Link className="secondary" href="/tasks">Tasks</Link>
          <Link className="secondary" href="/settings">Settings / Google Sheets Sync</Link>
        </div>
      </div>
    </section>
  );
}
