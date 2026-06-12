import { countApplicationsForTodayAndWeek } from "@/lib/analytics";
import { getAdminSession, getGuestSession } from "@/lib/authServer";
import { ensureFollowUpTasks } from "@/lib/followUpTasks";
import { getGuestDashboardSummary } from "@/lib/guestSummary";
import { prisma } from "@/lib/prisma";
import { ReviewItemType, ReviewStatus } from "@prisma/client";

type HomePageProps = {
  searchParams: Promise<{
    guest?: string;
  }>;
};

function GuestAccessScreen({ invalid }: { invalid: boolean }) {
  return (
    <section className="guest-access-page">
      <div className="card guest-access-card stack">
        <div className="stack compact-stack">
          <h2>Guest Access</h2>
          <p className="muted">Enter the shared access code to view a read-only tracker dashboard.</p>
        </div>

        {invalid ? <p className="error">That access code did not work. Please try again.</p> : null}

        <form className="stack" action="/api/guest/login" method="post">
          <label>
            Access Code
            <input name="accessCode" type="password" autoComplete="current-password" required />
          </label>
          <button className="primary guest-button" type="submit">
            View Dashboard
          </button>
        </form>
      </div>
    </section>
  );
}

async function GuestDashboard() {
  const summary = await getGuestDashboardSummary(prisma);
  const statusEntries = Object.entries(summary.statusCounts);

  return (
    <section className="page guest-dashboard stack">
      <div className="page-header">
        <h2 className="section-title">Guest Dashboard</h2>
        <p className="muted">Read-only accountability snapshot. Editing and private integrations are admin-only.</p>
      </div>

      <div className="grid guest-stats">
        <article className="card guest-metric-card">
          <p className="muted">Applications today</p>
          <p className="stat-value">{summary.applicationsToday}</p>
        </article>
        <article className="card guest-metric-card">
          <p className="muted">Applications yesterday</p>
          <p className="stat-value">{summary.applicationsYesterday}</p>
        </article>
        <article className="card guest-metric-card">
          <p className="muted">Applications this week</p>
          <p className="stat-value">{summary.applicationsThisWeek}</p>
        </article>
        <article className="card guest-metric-card">
          <p className="muted">Total applications</p>
          <p className="stat-value">{summary.totalApplications}</p>
        </article>
        <article className="card guest-metric-card">
          <p className="muted">Active tasks</p>
          <p className="stat-value">{summary.activeTasksCount}</p>
        </article>
        <article className="card guest-metric-card">
          <p className="muted">Follow-ups due</p>
          <p className="stat-value">{summary.followUpDueCount}</p>
        </article>
      </div>

      <div className="grid two-column-grid">
        <section className="card stack">
          <h3 className="section-title">Application Status</h3>
          <div className="status-list">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="status-row">
                <span>{status}</span>
                <span className="badge">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <h3 className="section-title">Full Tracker</h3>
          {summary.googleSheetUrl ? (
            <a className="primary guest-button" href={summary.googleSheetUrl} target="_blank" rel="noopener noreferrer">
              Open Google Sheet
            </a>
          ) : (
            <p className="muted">Google Sheet link not configured.</p>
          )}
          <form action="/api/guest/logout" method="post">
            <button className="secondary guest-button" type="submit">
              Sign out
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}

async function AdminDashboard() {
  await ensureFollowUpTasks(prisma);

  const [applications, totalApplications, pendingTasks, pendingReviewItems, pendingStatusUpdates, pendingReviewTasks, lastScan, recentApplications] =
    await Promise.all([
      prisma.application.findMany({
        select: { id: true, company: true, dateApplied: true },
      }),
      prisma.application.count(),
      prisma.task.count({ where: { status: "pending" } }),
      prisma.reviewItem.count({ where: { reviewStatus: ReviewStatus.pending } }),
      prisma.reviewItem.count({
        where: { reviewStatus: ReviewStatus.pending, type: ReviewItemType.status_update },
      }),
      prisma.reviewItem.count({
        where: { reviewStatus: ReviewStatus.pending, type: ReviewItemType.task },
      }),
      prisma.scanHistory.findFirst({ orderBy: { scanEndedAt: "desc" } }),
      prisma.application.findMany({
        orderBy: [{ dateApplied: "desc" }, { createdAt: "desc" }, { updatedAt: "desc" }],
        take: 8,
      }),
    ]);
  const { applicationsToday, applicationsThisWeek } = countApplicationsForTodayAndWeek(applications);

  return (
    <section className="page stack">
      <div>
        <h2 className="section-title">Dashboard</h2>
        <p className="muted">Track application momentum and pending follow-ups.</p>
      </div>

      <div className="grid stats">
        <article className="card">
          <p className="muted">Applications today</p>
          <p className="stat-value">{applicationsToday}</p>
        </article>
        <article className="card">
          <p className="muted">Applications this week</p>
          <p className="stat-value">{applicationsThisWeek}</p>
        </article>
        <article className="card">
          <p className="muted">Total applications</p>
          <p className="stat-value">{totalApplications}</p>
        </article>
        <article className="card">
          <p className="muted">Pending tasks</p>
          <p className="stat-value">{pendingTasks}</p>
        </article>
        <article className="card">
          <p className="muted">Pending review items</p>
          <p className="stat-value">{pendingReviewItems}</p>
        </article>
        <article className="card">
          <p className="muted">Pending status updates</p>
          <p className="stat-value">{pendingStatusUpdates}</p>
        </article>
        <article className="card">
          <p className="muted">Pending review tasks</p>
          <p className="stat-value">{pendingReviewTasks}</p>
        </article>
        <article className="card">
          <p className="muted">Last Gmail scan</p>
          <p className="stat-value" style={{ fontSize: "1rem" }}>
            {lastScan ? new Date(lastScan.scanEndedAt).toLocaleString() : "Never"}
          </p>
        </article>
      </div>

      <div className="card">
        <h3 className="section-title">Recent Applications</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Date Applied</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentApplications.map((application) => (
                <tr key={application.id}>
                  <td>{application.company}</td>
                  <td>{application.role}</td>
                  <td>{application.dateApplied.toISOString().slice(0, 10)}</td>
                  <td>{application.status}</td>
                </tr>
              ))}
              {recentApplications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No applications yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [adminSession, guestSession, params] = await Promise.all([
    getAdminSession(),
    getGuestSession(),
    searchParams,
  ]);

  if (adminSession) return AdminDashboard();
  if (guestSession) return GuestDashboard();

  return <GuestAccessScreen invalid={params.guest === "invalid"} />;
}
