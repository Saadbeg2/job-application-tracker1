import { ApplicationStatus, ReviewItemType } from "@prisma/client";

type ClassifierInput = {
  sender: string;
  subject: string;
  snippet: string;
};

type ClassificationResult = {
  type: ReviewItemType;
  confidence: number;
  company: string;
  role: string | null;
  suggestedStatus: ApplicationStatus | null;
  taskTitle: string | null;
  reason: string;
};

const newApplicationPhrases = [
  "thanks for applying",
  "thank you for applying",
  "application received",
  "application submitted",
  "we received your application",
  "your application has been submitted",
  "thank you for your interest",
  "we have received your application",
];

const rejectionPhrases = [
  "unfortunately",
  "we regret to inform you",
  "not selected",
  "unable to move forward",
  "sadly unable to move forward",
  "we regret",
  "not moving forward",
];

const interviewPhrases = ["interview", "schedule a call", "recruiter screen", "next steps", "moving forward"];

const strongOfferPhrases = [
  "we are pleased to offer you",
  "offer of employment",
  "your offer letter",
  "congratulations, we would like to offer",
  "employment offer",
];

const taskPhrases = [
  "task awaiting you",
  "action required",
  "complete your assessment",
  "complete your application",
  "candidate portal",
  "coding challenge",
  "questionnaire",
  "please complete",
  "submit",
];

const actionWords = [
  "action required",
  "complete",
  "submit",
  "task awaiting you",
  "verify",
  "assessment",
  "questionnaire",
];

const jobContextIndicators = [
  "application",
  "candidate",
  "candidate home",
  "candidate portal",
  "job",
  "position",
  "interview",
  "recruiter",
  "hiring",
  "careers",
  "assessment",
  "coding challenge",
  "workday",
  "greenhouse",
  "lever",
  "icims",
  "smartrecruiters",
  "oracle recruiting",
  "workday recruiting",
];

const consumerVerificationIndicators = [
  "shopping account",
  "verify your email",
  "verify your account",
  "account verification",
  "confirm your email",
  "password reset",
  "login code",
  "security alert",
  "two-factor",
  "2fa",
  "one-time code",
  "otp",
];

const consumerFinanceIndicators = [
  "creditwise",
  "credit score",
  "credit review",
  "bank account",
  "card account",
  "statement",
  "payment due",
  "transaction",
  "account alert",
  "capital one shopping",
];

const newsletterIndicators = [
  "weekly digest",
  "daily digest",
  "newsletter",
  "top picks for you",
  "recommended jobs",
  "job alert",
  "jobs you may like",
  "new jobs for you",
  "unsubscribe",
  "digest",
];

const likelyNewsletterSenderIndicators = ["leetcode.com", "newsletter", "newsletters", "marketing"];

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

function extractCompanyFromSender(sender: string) {
  const emailMatch = sender.match(/<([^>]+)>/) || sender.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const email = emailMatch?.[1] ?? emailMatch?.[0] ?? "";
  const localPart = email.split("@")[0] ?? "";
  const domain = email.split("@")[1] ?? "";
  const domainLower = domain.toLowerCase();

  // Workday special-case: "dow@myworkday.com" should map to "Dow", not "Myworkday".
  if (domainLower.includes("myworkday.com") && localPart) {
    return localPart
      .split(/[._-]/)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  }

  if (domainLower.includes("amazon.jobs")) {
    return "Amazon";
  }

  if (domainLower.includes("nagarro.com")) {
    return "Nagarro";
  }

  const domainLabel = domain.split(".")[0] ?? "";
  if (!domainLabel) return "Unknown Company";
  return domainLabel
    .split(/[-_]/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function extractCompany(text: string, sender: string) {
  const cleanedText = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /your application was sent to\s+([^\n\r.,;:!?]+?)(?:[.,;:!?]|\n|\r|$)/i,
    /thank you for applying to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /application to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /applying to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /thanks for applying to\s+([A-Za-z0-9 &.-]+)/i,
    /your application to\s+([A-Za-z0-9 &.-]+)/i,
    /interview with\s+([A-Za-z0-9 &.-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanedText.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      // Guard against role phrases being mistaken for company names.
      if (/^the position\b/i.test(candidate) || /^position\b/i.test(candidate)) {
        continue;
      }
      // Guard against extracting the user's name from phrases like "Interview with Saad Beg".
      if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(candidate)) {
        continue;
      }
      return candidate;
    }
  }

  return extractCompanyFromSender(sender);
}

function extractRole(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:the\s+)?position\s+of\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,100}?)(?:\s+at\s+[A-Za-z0-9]|[.!,:;]|$)/i,
    /about\s+the\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,100}?)\s+position/i,
    /appl(?:y|ied)\s+to\s+the\s+position\s+for\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80}?)(?:[.!,:;]|$)/i,
    /position\s+for\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80}?)(?:[.!,:;]|$)/i,
    /application\s+for\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80}?)(?:[.!,:;]|$)/i,
    /for the\s+([A-Za-z0-9 /-]+?)\s+position/i,
    /your application for\s+([A-Za-z0-9 /-]+)/i,
    /(software engineer|backend engineer|frontend engineer|new grad software engineer|data engineer)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const noParens = match[1].replace(/\([^)]*\)/g, " ");
      return noParens.trim().replace(/\s+/g, " ");
    }
    if (match?.[0] && pattern.source.includes("software engineer")) return match[0].trim();
  }

  return null;
}

function chooseTaskTitle(text: string) {
  if (text.includes("coding challenge")) return "Complete coding challenge";
  if (text.includes("assessment")) return "Complete assessment";
  if (text.includes("questionnaire")) return "Submit questionnaire";
  if (text.includes("candidate portal")) return "Complete candidate portal task";
  if (text.includes("complete your application")) return "Complete application";
  return "Complete action required task";
}

export function classifyGmailMessage(input: ClassifierInput): ClassificationResult {
  const merged = `${input.subject} ${input.snippet}`.toLowerCase();
  const sourceText = `${input.subject} ${input.snippet}`;
  const company = extractCompany(sourceText, input.sender);
  const role = extractRole(sourceText);
  const senderLower = input.sender.toLowerCase();

  const hasStrongApplicationSignal =
    includesAny(merged, newApplicationPhrases) ||
    includesAny(merged, rejectionPhrases) ||
    includesAny(merged, interviewPhrases) ||
    includesAny(merged, taskPhrases) ||
    includesAny(merged, strongOfferPhrases) ||
    /your application was sent to\s+/i.test(sourceText);

  const hasActionWords = includesAny(merged, actionWords);
  const hasJobContext = includesAny(merged, jobContextIndicators);
  const hasConsumerVerificationSignals =
    includesAny(merged, consumerVerificationIndicators) ||
    senderLower.includes("capitaloneshopping.com") ||
    senderLower.includes("accounts.");
  const hasConsumerFinanceSignals =
    includesAny(merged, consumerFinanceIndicators) ||
    senderLower.includes("notification.capitalone.com");

  const looksLikeNewsletter =
    includesAny(merged, newsletterIndicators) ||
    likelyNewsletterSenderIndicators.some((indicator) => senderLower.includes(indicator));

  // Filter generic digests/promotions unless there is explicit application-status/task language.
  if (looksLikeNewsletter && !hasStrongApplicationSignal) {
    return {
      type: ReviewItemType.unknown_job_related,
      confidence: 0.1,
      company,
      role,
      suggestedStatus: null,
      taskTitle: null,
      reason: "Newsletter/promotional content detected without strong application signal",
    };
  }

  // Ignore generic account/security verification emails unless they clearly include job/candidate context.
  if (hasConsumerVerificationSignals && (!hasJobContext || !hasStrongApplicationSignal)) {
    return {
      type: ReviewItemType.unknown_job_related,
      confidence: 0.1,
      company,
      role,
      suggestedStatus: null,
      taskTitle: null,
      reason: "Consumer account/security verification pattern detected without job context",
    };
  }

  if (hasConsumerFinanceSignals && (!hasJobContext || !hasStrongApplicationSignal)) {
    return {
      type: ReviewItemType.unknown_job_related,
      confidence: 0.1,
      company,
      role,
      suggestedStatus: null,
      taskTitle: null,
      reason: "Consumer finance/banking notification detected without job context",
    };
  }

  const isLinkedInSender = input.sender.toLowerCase().includes("linkedin.com");
  const linkedInApplyMatch = sourceText.match(
    /your application was sent to\s+([^\n\r.,;:!?]+?)(?:[.,;:!?]|\n|\r|$)/i,
  );
  if (isLinkedInSender && linkedInApplyMatch?.[1]) {
    return {
      type: ReviewItemType.new_application,
      confidence: 0.9,
      company: linkedInApplyMatch[1].trim(),
      role: role ?? null,
      suggestedStatus: ApplicationStatus.Applied,
      taskTitle: null,
      reason: "LinkedIn Easy Apply application-sent pattern detected",
    };
  }

  // Rejection/status update should override application-confirmation language.
  if (includesAny(merged, rejectionPhrases)) {
    return {
      type: ReviewItemType.status_update,
      confidence: 0.9,
      company,
      role,
      suggestedStatus: ApplicationStatus.Rejected,
      taskTitle: null,
      reason: "Rejection phrase detected",
    };
  }

  if (includesAny(merged, newApplicationPhrases)) {
    return {
      type: ReviewItemType.new_application,
      confidence: 0.9,
      company,
      role,
      suggestedStatus: ApplicationStatus.Applied,
      taskTitle: null,
      reason: "Application confirmation phrase detected",
    };
  }

  if (includesAny(merged, strongOfferPhrases)) {
    return {
      type: ReviewItemType.status_update,
      confidence: 0.88,
      company,
      role,
      suggestedStatus: ApplicationStatus.Offer,
      taskTitle: null,
      reason: "Offer phrase detected",
    };
  }

  if (includesAny(merged, interviewPhrases)) {
    return {
      type: ReviewItemType.status_update,
      confidence: 0.84,
      company,
      role,
      suggestedStatus: ApplicationStatus.Interview,
      taskTitle: null,
      reason: "Interview/update phrase detected",
    };
  }

  if (includesAny(merged, taskPhrases) && hasActionWords && hasJobContext) {
    return {
      type: ReviewItemType.task,
      confidence: 0.82,
      company,
      role,
      suggestedStatus: null,
      taskTitle: chooseTaskTitle(merged),
      reason: "Action-required phrase detected",
    };
  }

  return {
    type: ReviewItemType.unknown_job_related,
    confidence: 0.5,
    company,
    role,
    suggestedStatus: null,
    taskTitle: null,
    reason: "Potentially job-related but low confidence",
  };
}

export const gmailScanQuery =
  'newer_than:7d ("thank you for applying" OR "application received" OR "application submitted" OR "we received your application" OR "your application has been submitted" OR "thank you for your interest" OR "unfortunately" OR "we regret to inform you" OR "not selected" OR "next steps" OR "interview" OR "schedule a call" OR "task awaiting you" OR "action required" OR "complete your assessment" OR "candidate portal" OR "coding challenge")';

/*
Inline classifier examples (no test harness currently configured):
1) Sender: dow@myworkday.com
   Subject/snippet: "Thank you for applying to the position for IT Analyst..."
   Expected extraction: company="Dow", role="IT Analyst"

2) Sender: jobs@company.com
   Snippet: "Your application for Backend Engineer has been received"
   Expected role extraction: "Backend Engineer"

3) Sender: LinkedIn <jobs-noreply@linkedin.com>
   Subject: "Saad Salman, your application was sent to BrothersTech"
   Expected: type=new_application, company="BrothersTech", suggestedStatus=Applied, high confidence.

4) Sender: no-reply@agoda.global
   Subject/snippet: "Thank you for applying to Agoda ... position of Data Analyst (...) at Agoda"
   Expected: type=new_application, company="Agoda", role="Data Analyst", suggestedStatus=Applied.

5) Sender: no-reply@agoda.global
   Subject/snippet: "Regarding your Application to Agoda ... sadly unable to move forward ..."
   Expected: type=status_update, company="Agoda", role="Data Analyst", suggestedStatus=Rejected.

6) Sender: LeetCode <no-reply@leetcode.com>
   Subject/snippet: "LeetCode Weekly Digest ... shared both offers ..."
   Expected: unknown_job_related with very low confidence (~0.1), so scan skips review-item creation.

7) Subject/snippet contains: "We are pleased to offer you ..." / "offer of employment"
   Expected: status_update, suggestedStatus=Offer.

8) Sender: Capital One Shopping <help@accounts.capitaloneshopping.com>
   Subject/snippet: "Action Required ... verify your account/email"
   Expected: unknown_job_related with very low confidence (~0.1), so scan skips review-item creation.

9) Sender: Capital One <capitalone@notification.capitalone.com>
   Subject/snippet: "See your latest review from CreditWise"
   Expected: unknown_job_related with very low confidence (~0.1), so scan skips review-item creation.
*/
