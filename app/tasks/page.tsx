"use client";

import { taskStatuses } from "@/lib/constants";
import { useEffect, useMemo, useState } from "react";

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

type FollowUpCompletionState = {
  taskId: number;
  followedUpWith: string;
  followUpNotes: string;
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
  const [showForm, setShowForm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [followUpCompletion, setFollowUpCompletion] = useState<FollowUpCompletionState | null>(null);

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
    setShowForm(false);
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

  async function completeTask(task: Task, extra: { followedUpWith?: string; followUpNotes?: string } = {}) {
    setError("");
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: task.applicationId,
        company: task.company,
        role: task.role ?? "",
        title: task.title,
        status: "completed",
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
        sourceEmailSubject: task.sourceEmailSubject,
        notes: task.notes ?? "",
        followedUpWith: extra.followedUpWith,
        followUpNotes: extra.followUpNotes,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Failed to complete task");
      return;
    }

    setFollowUpCompletion(null);
    setTasks(await loadTasks());
  }

  async function submitFollowUpCompletion(task: Task) {
    if (!followUpCompletion || followUpCompletion.taskId !== task.id) return;
    if (!followUpCompletion.followedUpWith.trim()) {
      setError("Who you followed up with is required.");
      return;
    }

    await completeTask(task, {
      followedUpWith: followUpCompletion.followedUpWith.trim(),
      followUpNotes: followUpCompletion.followUpNotes.trim(),
    });
  }

  function startFollowUpCompletion(task: Task) {
    setError("");
    setFollowUpCompletion({
      taskId: task.id,
      followedUpWith: "",
      followUpNotes: "",
    });
  }

  function startEdit(task: Task) {
    setShowForm(true);
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

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredTasks = useMemo(() => {
    if (!normalizedSearch) return tasks;
    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.notes ?? "",
        task.company,
        task.role ?? "",
        task.status,
        task.dueDate?.slice(0, 10) ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [tasks, normalizedSearch]);

  const activeTasks = useMemo(() => {
    return filteredTasks
      .filter((task) => task.status !== "completed")
      .sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    return filteredTasks
      .filter((task) => task.status === "completed")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filteredTasks]);

  function renderTasksTable(rows: Task[], completed = false) {
    return (
      <div className={`card table-wrap${completed ? " completed-tasks" : ""}`}>
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
            {rows.map((task) => (
              <tr key={task.id}>
                <td>
                  <div className="stack compact-stack">
                    <span>{task.title}</span>
                    {followUpCompletion?.taskId === task.id ? (
                      <div className="inline-form">
                        <label>
                          Who did you follow up with? *
                          <input
                            value={followUpCompletion.followedUpWith}
                            onChange={(e) =>
                              setFollowUpCompletion((prev) =>
                                prev?.taskId === task.id ? { ...prev, followedUpWith: e.target.value } : prev,
                              )
                            }
                            placeholder="Recruiter or hiring manager name"
                          />
                        </label>
                        <label>
                          Follow-up notes
                          <textarea
                            value={followUpCompletion.followUpNotes}
                            onChange={(e) =>
                              setFollowUpCompletion((prev) =>
                                prev?.taskId === task.id ? { ...prev, followUpNotes: e.target.value } : prev,
                              )
                            }
                            placeholder="Optional note about where/how you followed up"
                          />
                        </label>
                        <div className="actions">
                          <button className="primary" type="button" onClick={() => void submitFollowUpCompletion(task)}>
                            Confirm Complete
                          </button>
                          <button className="secondary" type="button" onClick={() => setFollowUpCompletion(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>{task.company}</td>
                <td>{completed ? <span className="badge">completed</span> : task.status}</td>
                <td>{task.dueDate ? task.dueDate.slice(0, 10) : "-"}</td>
                <td>{task.sourceEmailSubject}</td>
                <td>
                  <div className="actions">
                    {!completed ? (
                      task.sourceEmailSubject === "Auto Follow-Up" && task.applicationId ? (
                        <button className="primary" type="button" onClick={() => startFollowUpCompletion(task)}>
                          Complete
                        </button>
                      ) : (
                        <button className="primary" type="button" onClick={() => void completeTask(task)}>
                          Complete
                        </button>
                      )
                    ) : null}
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
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="page stack">
      <h2 className="section-title">Tasks</h2>

      <div className="card stack">
        <div className="actions">
          <button
            className="primary"
            type="button"
            onClick={() => {
              setShowForm((prev) => !prev);
              if (editingId === null && showForm) {
                setForm(initialForm);
              }
            }}
          >
            {showForm ? "Close Form" : "Add Task"}
          </button>
          <button className="secondary" type="button" onClick={() => setShowSearch((prev) => !prev)}>
            {showSearch ? "Hide Search" : "Search"}
          </button>
        </div>

        {showSearch ? (
          <div className="form-grid">
            <label>
              Search Tasks
              <input
                aria-label="Search tasks"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search title, notes, company, role, status, due date"
              />
            </label>
            <button className="secondary" type="button" onClick={() => setSearchText("")}>Clear</button>
          </div>
        ) : null}
      </div>

      {(showForm || editingId !== null) ? (
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
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
                setShowForm(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <section className="stack">
        <div>
          <h3 className="section-title">Active Tasks</h3>
          <p className="muted">Tasks that still need action.</p>
        </div>
        {activeTasks.length > 0 ? renderTasksTable(activeTasks) : <p className="muted">No active tasks.</p>}
      </section>

      <section className="stack">
        <div>
          <h3 className="section-title">Completed Tasks</h3>
          <p className="muted">Tasks you have already handled.</p>
        </div>
        {completedTasks.length > 0 ? renderTasksTable(completedTasks, true) : <p className="muted">No completed tasks yet.</p>}
      </section>
    </section>
  );
}
