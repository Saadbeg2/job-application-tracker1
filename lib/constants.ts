export const applicationStatuses = [
  "Applied",
  "Interview",
  "Rejected",
  "Offer",
  "Withdrawn",
] as const;

export const taskStatuses = ["pending", "completed", "ignored"] as const;

export const reviewItemTypes = [
  "new_application",
  "status_update",
  "task",
  "unknown_job_related",
] as const;

export const reviewStatuses = ["pending", "approved", "ignored", "not_relevant"] as const;
