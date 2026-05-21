"use client";

import { applicationStatuses } from "@/lib/constants";
import { useEffect, useState } from "react";

type Application = {
  id: number;
  company: string;
  role: string;
  dateApplied: string;
  status: (typeof applicationStatuses)[number];
  source: string | null;
  jobLink: string;
  resumeUsed: string | null;
  notes: string | null;
  jobDescription: string | null;
  location: string | null;
  referral: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  company: string;
  role: string;
  dateApplied: string;
  status: (typeof applicationStatuses)[number];
  source: string;
  jobLink: string;
  resumeUsed: string;
  notes: string;
  jobDescription: string;
  location: string;
  referral: string;
};

const initialForm: FormState = {
  company: "",
  role: "",
  dateApplied: new Date().toISOString().slice(0, 10),
  status: "Applied",
  source: "",
  jobLink: "",
  resumeUsed: "",
  notes: "",
  jobDescription: "",
  location: "",
  referral: "",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadApplications() {
    const response = await fetch("/api/applications", { cache: "no-store" });
    const data = (await response.json()) as Application[];
    return data;
  }

  useEffect(() => {
    let active = true;
    void loadApplications().then((data) => {
      if (active) setApplications(data);
    });
    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveApplication() {
    setError("");
    const endpoint = editingId ? `/api/applications/${editingId}` : "/api/applications";
    const method = editingId ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Failed to save application");
      return;
    }

    setForm(initialForm);
    setEditingId(null);
    setApplications(await loadApplications());
  }

  async function deleteApplication(id: number) {
    const confirmed = window.confirm("Delete this application?");
    if (!confirmed) return;

    const response = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (response.ok) {
      if (editingId === id) {
        setEditingId(null);
        setForm(initialForm);
      }
      setApplications(await loadApplications());
    }
  }

  function startEdit(application: Application) {
    setEditingId(application.id);
    setForm({
      company: application.company,
      role: application.role,
      dateApplied: application.dateApplied.slice(0, 10),
      status: application.status,
      source: application.source ?? "",
      jobLink: application.jobLink,
      resumeUsed: application.resumeUsed ?? "",
      notes: application.notes ?? "",
      jobDescription: application.jobDescription ?? "",
      location: application.location ?? "",
      referral: application.referral ?? "",
    });
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Applications</h2>

      <div className="card stack">
        <h3>{editingId ? "Edit Application" : "New Application"}</h3>
        <div className="form-grid">
          <label>
            Company *
            <input value={form.company} onChange={(e) => updateField("company", e.target.value)} required />
          </label>
          <label>
            Role *
            <input value={form.role} onChange={(e) => updateField("role", e.target.value)} required />
          </label>
          <label>
            Date Applied *
            <input
              type="date"
              value={form.dateApplied}
              onChange={(e) => updateField("dateApplied", e.target.value)}
              required
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => updateField("status", e.target.value as FormState["status"])}>
              {applicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Job Link *
            <input value={form.jobLink} onChange={(e) => updateField("jobLink", e.target.value)} required />
          </label>
          <label>
            Source
            <input value={form.source} onChange={(e) => updateField("source", e.target.value)} />
          </label>
          <label>
            Resume Used
            <input value={form.resumeUsed} onChange={(e) => updateField("resumeUsed", e.target.value)} />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(e) => updateField("location", e.target.value)} />
          </label>
          <label>
            Referral
            <input value={form.referral} onChange={(e) => updateField("referral", e.target.value)} />
          </label>
          <label>
            Notes
            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
          </label>
          <label>
            Job Description
            <textarea
              value={form.jobDescription}
              onChange={(e) => updateField("jobDescription", e.target.value)}
            />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button className="primary" type="button" onClick={() => void saveApplication()}>
            {editingId ? "Update" : "Create"}
          </button>
          {editingId ? (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Date Applied</th>
              <th>Status</th>
              <th>Job Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id}>
                <td>{application.company}</td>
                <td>{application.role}</td>
                <td>{application.dateApplied.slice(0, 10)}</td>
                <td>{application.status}</td>
                <td>
                  <a href={application.jobLink} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </td>
                <td>
                  <div className="actions">
                    <button className="secondary" type="button" onClick={() => startEdit(application)}>
                      Edit
                    </button>
                    <button className="danger" type="button" onClick={() => void deleteApplication(application.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {applications.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No applications yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
