"use client";

import { useState } from "react";

type SuggestionStatus = "new" | "reviewed" | "dismissed" | "applied";

export type GuestCompanySuggestionForAdmin = {
  id: string;
  companyName: string;
  suggestedBy: string | null;
  notes: string | null;
  status: SuggestionStatus;
  createdAt: string;
  alreadyInApplications: boolean;
};

type Props = {
  initialSuggestions: GuestCompanySuggestionForAdmin[];
};

const actionLabels: Array<{ status: SuggestionStatus; label: string }> = [
  { status: "reviewed", label: "Mark reviewed" },
  { status: "dismissed", label: "Dismiss" },
  { status: "applied", label: "Mark applied" },
];

export function GuestCompanySuggestionsAdmin({ initialSuggestions }: Props) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [error, setError] = useState("");

  async function updateStatus(id: string, status: SuggestionStatus) {
    setError("");
    const response = await fetch(`/api/company-suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not update suggestion.");
      return;
    }

    const updated = (await response.json()) as GuestCompanySuggestionForAdmin;
    setSuggestions((prev) =>
      prev.map((suggestion) =>
        suggestion.id === id
          ? {
              ...suggestion,
              status: updated.status,
            }
          : suggestion,
      ),
    );
  }

  return (
    <section className="card stack">
      <div className="stack compact-stack">
        <h3 className="section-title">Guest Company Suggestions</h3>
        <p className="muted">Companies guests think may be worth checking. This does not auto-create applications.</p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {suggestions.length === 0 ? (
        <p className="muted">No guest company suggestions yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Suggested By</th>
                <th>Notes</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.id}>
                  <td>
                    <div className="stack compact-stack">
                      <span>{suggestion.companyName}</span>
                      {suggestion.alreadyInApplications ? <span className="badge">Already in applications</span> : null}
                    </div>
                  </td>
                  <td>{suggestion.suggestedBy || <span className="muted">-</span>}</td>
                  <td>{suggestion.notes || <span className="muted">-</span>}</td>
                  <td>{suggestion.createdAt.slice(0, 10)}</td>
                  <td>
                    <span className="badge">{suggestion.status}</span>
                  </td>
                  <td>
                    <div className="actions">
                      {actionLabels.map((action) => (
                        <button
                          key={action.status}
                          className={action.status === "dismissed" ? "danger" : "secondary"}
                          type="button"
                          disabled={suggestion.status === action.status}
                          onClick={() => void updateStatus(suggestion.id, action.status)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
