"use client";

import { taskStatuses } from "@/lib/constants";
import { useEffect, useState } from "react";

type Task = {
  id: number;
  applicationId: number | null;
  company: string;
  role: string | null;
  title: string;
  status: (typeof taskStatuses)[number];
  dueDate: string | null;
  sourceEmailSubject: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  applicationId: string;
  company: string;
  role: string;
  title: string;
  status: (typeof taskStatuses)[number];
  dueDate: string;
  sourceEmailSubject: string;
  notes: string;
};

const initialForm: FormState = {
  applicationId: "",
  company: "",
  role: "",
  title: "",
  status: "pending",
  dueDate: "",
  sourceEmailSubject: "manual",
  notes: "",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadTasks() {
    const response = await fetch("/api/tasks", { cache: "no-store" });
    const data = (await response.json()) as Task[];
    return data;
  }

  useEffect(() => {
    let active = true;
    void loadTasks().then((data) => {
      if (active) setTasks(data);
    });
    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveTask() {
    setError("");
    const endpoint = editingId ? `/api/tasks/${editingId}` : "/api/tasks";
    const method = editingId ? "PUT" : "POST";

    const payload = {
      ...form,
      applicationId: form.applicationId ? Number(form.applicationId) : null,
      dueDate: form.dueDate || null,
    };

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Failed to save task");
      return;
    }

    setForm(initialForm);
    setEditingId(null);
    setTasks(await loadTasks());
  }

  async function deleteTask(id: number) {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;

    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (response.ok) {
      if (editingId === id) {
        setEditingId(null);
        setForm(initialForm);
      }
      setTasks(await loadTasks());
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setForm({
      applicationId: task.applicationId?.toString() ?? "",
      company: task.company,
      role: task.role ?? "",
      title: task.title,
      status: task.status,
      dueDate: task.dueDate?.slice(0, 10) ?? "",
      sourceEmailSubject: task.sourceEmailSubject,
      notes: task.notes ?? "",
    });
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Tasks</h2>

      <div className="card stack">
        <h3>{editingId ? "Edit Task" : "New Task"}</h3>
        <div className="form-grid">
          <label>
            Company *
            <input value={form.company} onChange={(e) => updateField("company", e.target.value)} required />
          </label>
          <label>
            Role
            <input value={form.role} onChange={(e) => updateField("role", e.target.value)} />
          </label>
          <label>
            Task Title *
            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} required />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => updateField("status", e.target.value as FormState["status"])}>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due Date
            <input type="date" value={form.dueDate} onChange={(e) => updateField("dueDate", e.target.value)} />
          </label>
          <label>
            Linked Application ID
            <input
              value={form.applicationId}
              onChange={(e) => updateField("applicationId", e.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
          <label>
            Source Email Subject *
            <input
              value={form.sourceEmailSubject}
              onChange={(e) => updateField("sourceEmailSubject", e.target.value)}
              required
            />
          </label>
          <label>
            Notes
            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button className="primary" type="button" onClick={() => void saveTask()}>
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
              <th>Title</th>
              <th>Company</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Source Subject</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.company}</td>
                <td>{task.status}</td>
                <td>{task.dueDate ? task.dueDate.slice(0, 10) : "-"}</td>
                <td>{task.sourceEmailSubject}</td>
                <td>
                  <div className="actions">
                    <button className="secondary" type="button" onClick={() => startEdit(task)}>
                      Edit
                    </button>
                    <button className="danger" type="button" onClick={() => void deleteTask(task.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No tasks yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
