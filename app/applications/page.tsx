"use client";

import { applicationStatuses } from "@/lib/constants";
import { getTodayChicagoDateKey } from "@/lib/dates";
import { isApplicationStale } from "@/lib/followUpAlerts";
import { useEffect, useMemo, useRef, useState } from "react";

type Application = {
  id: number;
  company: string;
  role: string;
  dateApplied: string;
  status: (typeof applicationStatuses)[number];
  source: string | null;
  jobLink: string | null;
  resumeUsed: string | null;
  notes: string | null;
  jobDescription: string | null;
  location: string | null;
  referral: string | null;
  createdAt: string;
  updatedAt: string;
  lastFollowedUpAt: string | null;
  lastFollowedUpWith: string | null;
  lastFollowUpNotes: string | null;
  followUpCount: number;
  interviewStatus: string | null;
  interviewDate: string | null;
  interviewWith: string | null;
  interviewNotes: string | null;
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
  interviewStatus: string;
  interviewDate: string;
  interviewWith: string;
  interviewNotes: string;
};

const interviewStatusOptions = [
  "Screening / assessment completed",
  "Pending scheduling",
  "Scheduled",
  "Completed",
  "Waiting for next steps",
];

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatInterviewDate(value: string | null) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleString();
}

function createInitialForm(): FormState {
  return {
    company: "",
    role: "",
    dateApplied: getTodayChicagoDateKey(),
    status: "Applied",
    source: "",
    jobLink: "",
    resumeUsed: "",
    notes: "",
    jobDescription: "",
    location: "",
    referral: "",
    interviewStatus: "",
    interviewDate: "",
    interviewWith: "",
    interviewNotes: "",
  };
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Interview: true,
    Applied: true,
    Offer: true,
    Rejected: false,
    Withdrawn: false,
  });
  const formContainerRef = useRef<HTMLDivElement | null>(null);
  const companyInputRef = useRef<HTMLInputElement | null>(null);

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

    setForm(createInitialForm());
    setEditingId(null);
    setShowForm(false);
    setApplications(await loadApplications());
  }

  async function deleteApplication(id: number) {
    const confirmed = window.confirm("Delete this application?");
    if (!confirmed) return;

    const response = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (response.ok) {
      if (editingId === id) {
        setEditingId(null);
        setForm(createInitialForm());
      }
      setApplications(await loadApplications());
    }
  }

  function startEdit(application: Application) {
    setShowForm(true);
    setEditingId(application.id);
    setForm({
      company: application.company,
      role: application.role,
      dateApplied: application.dateApplied.slice(0, 10),
      status: application.status,
      source: application.source ?? "",
      jobLink: application.jobLink ?? "",
      resumeUsed: application.resumeUsed ?? "",
      notes: application.notes ?? "",
      jobDescription: application.jobDescription ?? "",
      location: application.location ?? "",
      referral: application.referral ?? "",
      interviewStatus: application.interviewStatus ?? "",
      interviewDate: toDateTimeLocalValue(application.interviewDate),
      interviewWith: application.interviewWith ?? "",
      interviewNotes: application.interviewNotes ?? "",
    });
    formContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      companyInputRef.current?.focus();
    }, 250);
  }

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredApplications = useMemo(() => {
    if (!normalizedSearch) return applications;
    return applications.filter((application) => {
      const haystack = [
        application.company,
        application.role,
        application.status,
        application.location ?? "",
        application.jobLink ?? "",
        application.lastFollowedUpWith ?? "",
        application.interviewStatus ?? "",
        application.interviewWith ?? "",
        application.interviewNotes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [applications, normalizedSearch]);

  const groupedApplications = useMemo(() => {
    const groups: Record<(typeof applicationStatuses)[number], Application[]> = {
      Interview: [],
      Applied: [],
      Offer: [],
      Rejected: [],
      Withdrawn: [],
    };

    for (const application of filteredApplications) {
      groups[application.status].push(application);
    }

    for (const status of applicationStatuses) {
      groups[status].sort(
        (a, b) => new Date(b.dateApplied).getTime() - new Date(a.dateApplied).getTime(),
      );
    }

    return groups;
  }, [filteredApplications]);

  function toggleSection(status: (typeof applicationStatuses)[number]) {
    setOpenSections((prev) => ({ ...prev, [status]: !prev[status] }));
  }

  function renderRows(rows: Application[], sectionStatus: (typeof applicationStatuses)[number]) {
    const showInterviewDetails = sectionStatus === "Interview";

    return rows.map((application) => (
      <tr key={application.id}>
        <td>{application.company}</td>
        <td>{application.role}</td>
        <td>{application.dateApplied.slice(0, 10)}</td>
        <td>{application.status}</td>
        {showInterviewDetails ? (
          <td>
            <div className="stack compact-stack">
              <span className="badge">{application.interviewStatus || "Interview process"}</span>
              <span className="muted">Date: {formatInterviewDate(application.interviewDate)}</span>
              <span className="muted">With: {application.interviewWith || "—"}</span>
              {application.interviewNotes ? <span>{application.interviewNotes}</span> : null}
            </div>
          </td>
        ) : null}
        <td>
          {isApplicationStale({
            id: application.id,
            company: application.company,
            role: application.role,
            status: application.status,
            dateApplied: new Date(application.dateApplied),
            lastFollowedUpAt: application.lastFollowedUpAt ? new Date(application.lastFollowedUpAt) : null,
            followUpCount: application.followUpCount,
          }) ? <span className="badge">Follow up</span> : <span className="muted">-</span>}
        </td>
        <td>
          {application.lastFollowedUpAt ? (
            <div className="stack compact-stack">
              <span>{application.lastFollowedUpAt.slice(0, 10)}</span>
              {application.lastFollowedUpWith ? <span className="muted">With: {application.lastFollowedUpWith}</span> : null}
              <span className="muted">Count: {application.followUpCount}</span>
            </div>
          ) : (
            <span className="muted">-</span>
          )}
        </td>
        <td>
          {application.jobLink ? (
            <a href={application.jobLink} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          ) : (
            <span className="muted">No link</span>
          )}
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
    ));
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Applications</h2>

      <div className="card stack">
        <div className="actions">
          <button
            className="primary"
            type="button"
            onClick={() => {
              setShowForm((prev) => !prev);
              if (editingId === null && showForm) {
                setForm(createInitialForm());
              }
            }}
          >
            {showForm ? "Close Form" : "Add Application"}
          </button>
          <button className="secondary" type="button" onClick={() => setShowSearch((prev) => !prev)}>
            {showSearch ? "Hide Search" : "Search"}
          </button>
        </div>

        {showSearch ? (
          <div className="form-grid">
            <label>
              Search Applications
              <input
                aria-label="Search applications"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search company, role, status, location, link"
              />
            </label>
            <button className="secondary" type="button" onClick={() => setSearchText("")}>
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {(showForm || editingId !== null) ? (
        <div ref={formContainerRef} className="card stack">
          <h3>{editingId ? "Edit Application" : "New Application"}</h3>
          <div className="form-grid">
            <label>
              Company *
              <input
                ref={companyInputRef}
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                required
              />
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
              Job Link
              <input value={form.jobLink} onChange={(e) => updateField("jobLink", e.target.value)} />
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
          {form.status === "Interview" ? (
            <div className="section-card stack">
              <div className="stack compact-stack">
                <h4>Interview Details</h4>
                <p className="muted">Track scheduling and next-step context while keeping the main status as Interview.</p>
              </div>
              <div className="form-grid">
                <label>
                  Interview Status
                  <select
                    value={form.interviewStatus}
                    onChange={(e) => updateField("interviewStatus", e.target.value)}
                  >
                    <option value="">Select interview status</option>
                    {interviewStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Interview Date
                  <input
                    type="datetime-local"
                    value={form.interviewDate}
                    onChange={(e) => updateField("interviewDate", e.target.value)}
                  />
                </label>
                <label>
                  Interview With
                  <input
                    value={form.interviewWith}
                    onChange={(e) => updateField("interviewWith", e.target.value)}
                    placeholder="Recruiter, hiring manager, panel, etc."
                  />
                </label>
                <label>
                  Interview Notes
                  <textarea
                    value={form.interviewNotes}
                    onChange={(e) => updateField("interviewNotes", e.target.value)}
                    placeholder="Assessment completed, next steps, prep notes..."
                  />
                </label>
              </div>
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button className="primary" type="button" onClick={() => void saveApplication()}>
              {editingId ? "Update" : "Create"}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(createInitialForm());
                setShowForm(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {(["Interview", "Applied", "Offer", "Rejected", "Withdrawn"] as const).map((status) => {
        const rows = groupedApplications[status];
        if (rows.length === 0) return null;
        const isOpen = openSections[status];
        const label = status === "Offer" ? "Offer / Accepted" : status;

        return (
          <section key={status} className="card stack">
            <button
              className="section-toggle"
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleSection(status)}
            >
              <span>{label}</span>
              <span className="badge">{rows.length}</span>
              <span className="muted" aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Date Applied</th>
                      <th>Status</th>
                      {status === "Interview" ? <th>Interview Pipeline</th> : null}
                      <th>Alert</th>
                      <th>Follow-Up</th>
                      <th>Job Link</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>{renderRows(rows, status)}</tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}

      {filteredApplications.length === 0 ? <p className="muted">No applications found.</p> : null}
    </section>
  );
}
