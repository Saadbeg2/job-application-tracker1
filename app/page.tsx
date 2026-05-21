import { countApplicationsForTodayAndWeek } from "@/lib/analytics";
import { ReviewItemType, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const [applications, totalApplications, pendingTasks, pendingReviewItems, pendingStatusUpdates, pendingReviewTasks, recentApplications] =
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
      prisma.application.findMany({
        orderBy: { dateApplied: "desc" },
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
