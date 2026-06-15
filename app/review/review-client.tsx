"use client";

import { applicationStatuses, reviewItemTypes } from "@/lib/constants";
import { toChicagoDateKey } from "@/lib/dates";
import { useEffect, useMemo, useState } from "react";

type ReviewItem = {
  id: number;
  type: (typeof reviewItemTypes)[number];
  reviewStatus: "pending" | "approved" | "ignored" | "not_relevant";
  company: string;
  role: string | null;
  location: string | null;
  suggestedStatus: (typeof applicationStatuses)[number] | null;
  taskTitle: string | null;
  source: string | null;
  gmailMessageId: string | null;
  threadId: string | null;
  emailSender: string | null;
  emailSubject: string | null;
  emailReceivedAt: string | null;
  confidence: number | null;
  matchedApplicationId: number | null;
  extractedDataJson: string | null;
};

type Match = {
  id: number;
  company: string;
  role: string;
  dateApplied: string;
  status: string;
  roleScore: number;
  dateKey: string;
};

type MatchResponse = {
  reviewItemType: string;
  matches: Match[];
  duplicateCandidates: Match[];
};

type EditState = {
  type: (typeof reviewItemTypes)[number];
  company: string;
  role: string;
  location: string;
  suggestedStatus: string;
  taskTitle: string;
  source: string;
  emailSubject: string;
  emailReceivedAt: string;
  matchedApplicationId: string;
  createMissingApplication: boolean;
};

export default function ReviewClient({ demoMode }: { demoMode: boolean }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [editing, setEditing] = useState<Record<number, EditState>>({});
  const [matchesById, setMatchesById] = useState<Record<number, MatchResponse>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [scanMessage, setScanMessage] = useState("");
  const [scanLoading, setScanLoading] = useState(false);

  async function readJsonSafe<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function loadItems() {
    const response = await fetch("/api/review-items", { cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json()) as ReviewItem[];
  }

  async function refresh() {
    setItems(await loadItems());
  }

  useEffect(() => {
    let active = true;
    void loadItems().then((data) => {
      if (active) setItems(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const pendingItems = useMemo(() => items.filter((item) => item.reviewStatus === "pending"), [items]);

  const groups = {
    newApps: pendingItems.filter((item) => item.type === "new_application"),
    statusUpdates: pendingItems.filter((item) => item.type === "status_update"),
    tasks: pendingItems.filter((item) => item.type === "task"),
    other: pendingItems.filter((item) => item.type === "unknown_job_related"),
  };

  function getEdit(item: ReviewItem): EditState {
    return (
      editing[item.id] ?? {
        type: item.type,
        company: item.company,
        role: item.role ?? "",
        location: item.location ?? "",
        suggestedStatus: item.suggestedStatus ?? "Applied",
        taskTitle: item.taskTitle ?? "",
        source: item.source ?? "Gmail",
        emailSubject: item.emailSubject ?? "",
        emailReceivedAt: item.emailReceivedAt?.slice(0, 10) ?? "",
        matchedApplicationId: item.matchedApplicationId?.toString() ?? "",
        createMissingApplication: false,
      }
    );
  }

  function setEdit(item: ReviewItem, patch: Partial<EditState>) {
    const next = { ...getEdit(item), ...patch };
    setEditing((prev) => ({ ...prev, [item.id]: next }));
  }

  async function loadMatches(itemId: number) {
    const response = await fetch(`/api/review-items/${itemId}/matches`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as MatchResponse;
    setMatchesById((prev) => ({ ...prev, [itemId]: data }));
  }

  async function ignoreItem(id: number) {
    const response = await fetch(`/api/review-items/${id}/ignore`, { method: "POST" });
    if (!response.ok) return;
    await refresh();
  }

  async function notRelevantItem(id: number) {
    const response = await fetch(`/api/review-items/${id}/not-relevant`, { method: "POST" });
    if (!response.ok) return;
    await refresh();
  }

  async function scanGmail() {
    setScanLoading(true);
    setScanMessage("");
    try {
      const response = await fetch("/api/gmail/scan", { method: "POST" });
      const data = (await readJsonSafe<
        | { error?: string }
        | {
            scannedMessages: number;
            createdReviewItems: number;
            skippedDuplicates: number;
            message?: string;
            demoMode?: boolean;
          }
      >(response)) ?? { error: "Gmail scan failed." };

      if (!response.ok) {
        setScanMessage(
          "error" in data && data.error
            ? data.error
            : "Gmail scan failed. Gmail is not connected. Connect Gmail in Settings first.",
        );
        return;
      }

      if ("scannedMessages" in data) {
        setScanMessage(
          data.message ??
            `Scan complete. Scanned ${data.scannedMessages}, created ${data.createdReviewItems} review items, skipped ${data.skippedDuplicates} duplicates.`,
        );
      }
      await refresh();
    } finally {
      setScanLoading(false);
    }
  }

  async function approve(item: ReviewItem, forceApprove = false) {
    const e = getEdit(item);
    setErrors((prev) => ({ ...prev, [item.id]: "" }));

    const payload = {
      type: e.type,
      company: e.company,
      role: e.role || null,
      location: e.location || null,
      suggestedStatus: e.suggestedStatus || null,
      taskTitle: e.taskTitle || null,
      source: e.source || null,
      emailSubject: e.emailSubject || null,
      emailReceivedAt: e.emailReceivedAt || null,
      matchedApplicationId: e.matchedApplicationId ? Number(e.matchedApplicationId) : null,
      createMissingApplication: e.createMissingApplication,
      forceApprove,
    };

    const response = await fetch(`/api/review-items/${item.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 409) {
      const data = (await readJsonSafe<{ error: string; duplicates?: Match[] }>(response)) ?? {
        error: "Possible duplicate application detected",
      };
      const details =
        data.duplicates && data.duplicates.length > 0
          ? ` Possible duplicates: ${data.duplicates.map((d) => `#${d.id} ${d.company} ${d.role} ${d.dateKey}`).join(" | ")}`
          : "";
      setErrors((prev) => ({
        ...prev,
        [item.id]: `${data.error}.${details}`,
      }));
      const shouldContinue = window.confirm(
        `${data.error}. A possible duplicate was found. Do you want to approve anyway?`,
      );
      if (shouldContinue) {
        await approve(item, true);
      }
      return;
    }

    if (!response.ok) {
      const data = await readJsonSafe<{ error?: string }>(response);
      setErrors((prev) => ({
        ...prev,
        [item.id]: data?.error ?? "Approval failed. Please try again.",
      }));
      return;
    }

    await refresh();
  }

  function renderCard(item: ReviewItem) {
    const e = getEdit(item);
    const matches = matchesById[item.id]?.matches ?? [];

    return (
      <article className="card stack" key={item.id}>
        <div>
          <p><strong>Type:</strong> {item.type}</p>
          <p><strong>Company:</strong> {item.company}</p>
          <p><strong>Role:</strong> {item.role ?? "-"}</p>
          <p><strong>Location:</strong> {item.location ?? "-"}</p>
          <p><strong>Email subject:</strong> {item.emailSubject ?? "-"}</p>
          <p><strong>Sender:</strong> {item.emailSender ?? "-"}</p>
          <p><strong>Received:</strong> {item.emailReceivedAt ? toChicagoDateKey(new Date(item.emailReceivedAt)) : "-"}</p>
          <p><strong>Confidence:</strong> {item.confidence ?? "-"}</p>
          <p><strong>Suggested status:</strong> {item.suggestedStatus ?? "-"}</p>
          <p><strong>Task title:</strong> {item.taskTitle ?? "-"}</p>
          <p><strong>Source:</strong> {item.source ?? "-"}</p>
          <p><strong>Review status:</strong> {item.reviewStatus}</p>
        </div>

        <div className="form-grid">
          <label>
            Type
            <select value={e.type} onChange={(ev) => setEdit(item, { type: ev.target.value as EditState["type"] })}>
              {reviewItemTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Company
            <input value={e.company} onChange={(ev) => setEdit(item, { company: ev.target.value })} />
          </label>
          <label>
            Role
            <input value={e.role} onChange={(ev) => setEdit(item, { role: ev.target.value })} />
          </label>
          <label>
            Location
            <input value={e.location} onChange={(ev) => setEdit(item, { location: ev.target.value })} />
          </label>
          <label>
            Suggested Status
            <select
              value={e.suggestedStatus}
              onChange={(ev) => setEdit(item, { suggestedStatus: ev.target.value })}
            >
              {applicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Task Title
            <input value={e.taskTitle} onChange={(ev) => setEdit(item, { taskTitle: ev.target.value })} />
          </label>
          <label>
            Source
            <input value={e.source} onChange={(ev) => setEdit(item, { source: ev.target.value })} />
          </label>
          <label>
            Email Subject
            <input value={e.emailSubject} onChange={(ev) => setEdit(item, { emailSubject: ev.target.value })} />
          </label>
          <label>
            Email Received Date
            <input
              type="date"
              value={e.emailReceivedAt}
              onChange={(ev) => setEdit(item, { emailReceivedAt: ev.target.value })}
            />
          </label>
          <label>
            Matched Application
            <select
              value={e.matchedApplicationId}
              onChange={(ev) => setEdit(item, { matchedApplicationId: ev.target.value })}
            >
              <option value="">None</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  #{match.id} {match.company} | {match.role} | {match.dateKey} | {match.status}
                </option>
              ))}
            </select>
          </label>
          {item.type === "status_update" ? (
            <label>
              No match? Create missing application
              <select
                value={e.createMissingApplication ? "yes" : "no"}
                onChange={(ev) =>
                  setEdit(item, { createMissingApplication: ev.target.value === "yes" })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          ) : null}
        </div>

        <div className="actions">
          <button className="primary" type="button" onClick={() => void approve(item)}>
            Approve
          </button>
          <button className="secondary" type="button" onClick={() => void loadMatches(item.id)}>
            Load Matches
          </button>
          <button className="secondary" type="button" onClick={() => void ignoreItem(item.id)}>
            Ignore
          </button>
          <button className="danger" type="button" onClick={() => void notRelevantItem(item.id)}>
            Not Relevant
          </button>
        </div>
        {errors[item.id] ? <p className="error">{errors[item.id]}</p> : null}
      </article>
    );
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Review Queue</h2>
      <p className="muted">Approve only after validating each item. Nothing is auto-applied.</p>
      {demoMode ? <p className="muted">Sample emails only. Demo scan does not connect to Gmail.</p> : null}
      <div className="actions">
        <button className="primary" type="button" onClick={() => void scanGmail()} disabled={scanLoading}>
          {scanLoading ? (demoMode ? "Running demo scan..." : "Scanning Gmail...") : demoMode ? "Run Demo Gmail Scan" : "Scan Gmail"}
        </button>
        <a className="secondary" href="/settings">
          Connect Gmail in Settings
        </a>
      </div>
      {scanMessage ? <p className={scanMessage.includes("failed") || scanMessage.includes("not connected") ? "error" : "muted"}>{scanMessage}</p> : null}

      <section className="stack">
        <h3>Possible New Applications</h3>
        {groups.newApps.length ? groups.newApps.map(renderCard) : <p className="muted">None pending.</p>}
      </section>

      <section className="stack">
        <h3>Possible Status Updates</h3>
        {groups.statusUpdates.length ? groups.statusUpdates.map(renderCard) : <p className="muted">None pending.</p>}
      </section>

      <section className="stack">
        <h3>Possible Tasks / Action Required</h3>
        {groups.tasks.length ? groups.tasks.map(renderCard) : <p className="muted">None pending.</p>}
      </section>

      <section className="stack">
        <h3>Other Job-Related Emails</h3>
        {groups.other.length ? groups.other.map(renderCard) : <p className="muted">None pending.</p>}
      </section>
    </section>
  );
}
