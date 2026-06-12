"use client";

import { useState } from "react";

const initialForm = {
  companyName: "",
  suggestedBy: "",
  notes: "",
};

export function GuestCompanySuggestionForm() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submitSuggestion() {
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/guest/company-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setMessage(data?.error ?? "Could not submit suggestion.");
      return;
    }

    setForm(initialForm);
    setStatus("success");
    setMessage("Thanks. Your company suggestion was submitted.");
  }

  return (
    <section className="card stack">
      <div className="stack compact-stack">
        <h3 className="section-title">Companies you think I may not have applied to</h3>
        <p className="muted">Share a company worth checking. This does not edit the tracker directly.</p>
      </div>

      <div className="form-grid">
        <label>
          Company name *
          <input
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
            placeholder="Example: Datadog"
            required
          />
        </label>
        <label>
          Your name
          <input
            value={form.suggestedBy}
            onChange={(event) => updateField("suggestedBy", event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Optional context, role ideas, location notes, etc."
          />
        </label>
      </div>

      {message ? <p className={status === "error" ? "error" : "success"}>{message}</p> : null}

      <button
        className="primary guest-button"
        type="button"
        disabled={status === "saving" || !form.companyName.trim()}
        onClick={() => void submitSuggestion()}
      >
        {status === "saving" ? "Submitting..." : "Submit suggestion"}
      </button>
    </section>
  );
}
