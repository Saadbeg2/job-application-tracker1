"use client";

import { useMemo, useState } from "react";

type StaleApplication = {
  id: number;
  company: string;
  role: string;
  status: "Applied" | "Interview" | "Rejected" | "Offer" | "Withdrawn";
  dateApplied: string;
  updatedAt: string;
  jobLink: string | null;
  lastFollowedUpAt: string | null;
  daysSinceLastUpdate: number;
};

type Props = {
  initialItems: StaleApplication[];
};

export function FollowUpSection({ initialItems }: Props) {
  const [items, setItems] = useState<StaleApplication[]>(initialItems);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const visible = useMemo(() => items.length > 0, [items]);

  async function handleFollowUp(id: number) {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/applications/${id}/mark-followed-up`, { method: "POST" });
      if (!response.ok) return;
      setItems((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setLoadingId(null);
    }
  }

  if (!visible) return null;

  return (
    <section className="stack">
      <h3 className="section-title">Needs Follow-Up</h3>
      <div className="grid">
        {items.map((application) => (
          <article key={application.id} className="card stack">
            <div className="stack" style={{ gap: "0.35rem" }}>
              <p><strong>Company:</strong> {application.company}</p>
              <p><strong>Role:</strong> {application.role}</p>
              <p><strong>Status:</strong> {application.status}</p>
              <p><strong>Days since last update:</strong> {application.daysSinceLastUpdate}</p>
              <p><strong>Date applied:</strong> {application.dateApplied.slice(0, 10)}</p>
              <p><strong>Last updated:</strong> {application.updatedAt.slice(0, 10)}</p>
              {application.jobLink ? (
                <p>
                  <strong>Job link:</strong>{" "}
                  <a href={application.jobLink} target="_blank" rel="noopener noreferrer">Open Job Link</a>
                </p>
              ) : null}
              <p className="muted">
                No update in {application.daysSinceLastUpdate} days. Find the recruiter or hiring manager for this role and send a polite follow-up message.
              </p>
              <p className="muted">
                Hi [Recruiter Name], I hope you’re doing well. I wanted to follow up on my application for the [Role] position at [Company]. I’m still very interested in the opportunity and would appreciate any update when available. Thank you!
              </p>
            </div>
            <div className="actions">
              {application.jobLink ? (
                <a className="secondary" href={application.jobLink} target="_blank" rel="noopener noreferrer">
                  Open Job Link
                </a>
              ) : null}
              <button
                className="primary"
                type="button"
                disabled={loadingId === application.id}
                onClick={() => void handleFollowUp(application.id)}
              >
                Mark Followed Up
              </button>
              <button
                className="secondary"
                type="button"
                disabled={loadingId === application.id}
                onClick={() => void handleFollowUp(application.id)}
              >
                Dismiss for Now
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
