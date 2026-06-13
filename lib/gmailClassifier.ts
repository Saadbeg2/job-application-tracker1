import { ApplicationStatus, ReviewItemType } from "@prisma/client";

export type ClassifierInput = {
  sender: string;
  subject: string;
  snippet: string;
  bodyText?: string | null;
};

export type ClassificationResult = {
  type: ReviewItemType;
  confidence: number;
  company: string;
  role: string | null;
  location: string | null;
  suggestedStatus: ApplicationStatus | null;
  taskTitle: string | null;
  reason: string;
};

type TextSection = {
  label: "subject" | "snippet" | "body";
  text: string;
};

type ExtractedFields = {
  company: string | null;
  role: string | null;
  location: string | null;
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
  "we've received your resume",
  "we have received your resume",
  "your resume has been received",
  "resume has been received",
  "received your resume",
  "reviewed by our recruiting team",
  "thank you for your interest in employment at",
  "interest in employment at",
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
const jobPlatformDomains = [
  "indeed.com",
  "linkedin.com",
  "myworkday.com",
  "greenhouse.io",
  "lever.co",
  "smartrecruiters.com",
  "icims.com",
  "applytojob.com",
];

const badExtractionPhrases = [
  "your application was sent",
  "thank you for applying",
  "application was received",
  "application received",
  "application submitted",
  "we received your application",
  "your resume has been received",
  "reviewed by our recruiting team",
  "candidate portal",
  "unsubscribe",
  "recommended jobs",
];

const roleWords = [
  "administrator",
  "analyst",
  "engineer",
  "developer",
  "specialist",
  "manager",
  "director",
  "intern",
  "architect",
  "consultant",
  "technician",
  "scientist",
  "associate",
  "infrastructure",
  "software",
  "data",
  "cloud",
  "systems",
  "network",
  "support",
];

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[!:;,]+$/g, "").trim();
}

function cleanCandidate(value: string) {
  return stripTrailingPunctuation(
    normalizeWhitespace(
      value
        .replace(/^[-–—•·|]+/, "")
        .replace(/[-–—•·|]+$/, "")
        .replace(/^company:\s*/i, "")
        .replace(/^role:\s*/i, "")
        .replace(/^job title:\s*/i, ""),
    ),
  );
}

function looksLikeSentence(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length > 8 && /\b(application|applying|received|submitted|thank|interest|position)\b/i.test(value);
}

function hasDuplicatedPhrase(value: string) {
  const lower = value.toLowerCase();
  return /(.{12,})\s+\1/.test(lower) || lower.split("your application was sent").length > 2;
}

function sanitizeCompany(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = cleanCandidate(value);
  const lower = cleaned.toLowerCase();
  if (!cleaned || cleaned.length > 80) return null;
  if (badExtractionPhrases.some((phrase) => lower.includes(phrase))) return null;
  if (cleaned.includes("---")) return null;
  if (hasDuplicatedPhrase(cleaned)) return null;
  if (looksLikeSentence(cleaned)) return null;
  if (/^the\s+/i.test(cleaned) && roleWords.some((word) => lower.includes(word))) return null;
  if (/^(role|position|job|application)\b/i.test(cleaned)) return null;
  return cleaned;
}

function sanitizeRole(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = cleanCandidate(value).replace(/\s+role$/i, "").trim();
  const lower = cleaned.toLowerCase();
  if (!cleaned || cleaned.length > 120) return null;
  if (badExtractionPhrases.some((phrase) => lower.includes(phrase))) return null;
  if (cleaned.includes("---")) return null;
  if (hasDuplicatedPhrase(cleaned)) return null;
  if (looksLikeSentence(cleaned)) return null;
  return cleaned;
}

function createTextSections(input: ClassifierInput): TextSection[] {
  const sections: TextSection[] = [
    { label: "subject", text: input.subject },
    { label: "snippet", text: input.snippet },
    { label: "body", text: input.bodyText ?? "" },
  ];

  return sections
    .map((section) => ({ ...section, text: section.text.trim() }))
    .filter((section) => section.text.length > 0);
}

function linesFromText(text: string) {
  return text
    .split(/\r?\n+/)
    .map((line) => cleanCandidate(line))
    .filter(Boolean);
}

function extractDisplayNameFromSender(sender: string) {
  const trimmed = sender.trim();
  const angleIndex = trimmed.indexOf("<");
  const rawDisplay = angleIndex > 0 ? trimmed.slice(0, angleIndex).trim() : "";
  const cleaned = rawDisplay.replace(/^["']|["']$/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.includes("@")) return null;
  if (/^(noreply|no-reply|notifications?)$/i.test(cleaned)) return null;
  return cleaned;
}

function extractCompanyFromSender(sender: string) {
  const emailMatch = sender.match(/<([^>]+)>/) || sender.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const email = emailMatch?.[1] ?? emailMatch?.[0] ?? "";
  const localPart = email.split("@")[0] ?? "";
  const domain = email.split("@")[1] ?? "";
  const domainLower = domain.toLowerCase();

  if (domainLower.includes("myworkday.com") && localPart) {
    return sanitizeCompany(
      localPart
        .split(/[._-]/)
        .filter(Boolean)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(" "),
    ) ?? "Unknown Company";
  }

  if (domainLower.includes("amazon.jobs")) return "Amazon";
  if (domainLower.includes("nagarro.com")) return "Nagarro";
  if (domainLower.includes("indeed.com")) return "Unknown Company";
  if (domainLower.includes("applytojob.com")) {
    return sanitizeCompany(extractDisplayNameFromSender(sender)) ?? "Unknown Company";
  }

  const fromPlatform = jobPlatformDomains.some((platformDomain) => domainLower.includes(platformDomain));
  if (fromPlatform) {
    return sanitizeCompany(extractDisplayNameFromSender(sender)) ?? "Unknown Company";
  }

  const domainLabel = domain.split(".")[0] ?? "";
  if (!domainLabel) return "Unknown Company";
  return sanitizeCompany(
    domainLabel
      .split(/[-_]/)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" "),
  ) ?? "Unknown Company";
}

function extractLocation(text: string) {
  const cleanedText = text.replace(/\s+/g, " ").trim();

  const unitedStatesRemoteMatch = cleanedText.match(/\bunited states\s*\(\s*remote\s*\)/i);
  if (unitedStatesRemoteMatch) return "United States (Remote)";

  const remoteMatch = cleanedText.match(/\b(remote,\s*us|united states remote|remote|hybrid)\b/i);
  if (remoteMatch?.[1]) {
    const raw = remoteMatch[1].trim();
    if (/^remote,\s*us$/i.test(raw)) return "Remote, US";
    if (/^united states remote$/i.test(raw)) return "United States Remote";
    if (/^hybrid$/i.test(raw)) return "Hybrid";
    return "Remote";
  }

  const labelMatch = cleanedText.match(
    /\b(?:job location|location):\s*([A-Za-z .'-]+,\s*[A-Z]{2}|united states\s*\(\s*remote\s*\)|remote(?:,\s*[A-Za-z]+)?|united states remote|hybrid)\b/i,
  );
  if (labelMatch?.[1]) return labelMatch[1].trim().replace(/\s+/g, " ");

  const dashMatch = cleanedText.match(
    /\b([A-Z][A-Za-z0-9 '&.-]{1,80}|[A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80})\s*[-–—·•]\s*([A-Za-z .'-]+,\s*[A-Z]{2}|united states\s*\(\s*remote\s*\)|remote(?:,\s*[A-Za-z]+)?|united states remote|hybrid)\b/i,
  );
  if (dashMatch?.[2]) return dashMatch[2].trim().replace(/\s+/g, " ");

  const cityStateMatch = cleanedText.match(/\b([A-Za-z .'-]+,\s*[A-Z]{2})\b/);
  if (cityStateMatch?.[1]) return cityStateMatch[1].trim();

  return null;
}

function extractIndeedCompany(text: string) {
  const cleanedText = text.replace(/\s+/g, " ").trim();

  const sentToMatch = cleanedText.match(/the following items were sent to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})/i);
  if (sentToMatch?.[1]) return sanitizeCompany(sentToMatch[1]);

  const companyDashLocationMatch = cleanedText.match(
    /\b([A-Z][A-Za-z0-9 '&.-]{1,80})\s*[-–—·•]\s*([A-Za-z .'-]+,\s*[A-Z]{2}|united states\s*\(\s*remote\s*\)|remote(?:,\s*[A-Za-z]+)?|united states remote|hybrid)\b/i,
  );
  if (companyDashLocationMatch?.[1]) return sanitizeCompany(companyDashLocationMatch[1]);

  return null;
}

function parseLinkedInApplication(sender: string, sections: TextSection[]): ExtractedFields | null {
  const subject = sections.find((section) => section.label === "subject")?.text ?? "";
  const isLinkedIn = sender.toLowerCase().includes("linkedin.com") || /your application was sent to\s+/i.test(subject);
  if (!isLinkedIn) return null;

  const subjectMatch = subject.match(/your application was sent to\s+(.+?)\s*$/i);
  const subjectCompany = sanitizeCompany(subjectMatch?.[1]);
  if (!subjectCompany) return null;

  let role: string | null = null;
  let location: string | null = null;
  let bodyCompany: string | null = null;

  for (const section of sections.filter((candidate) => candidate.label !== "subject")) {
    const lines = linesFromText(section.text);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const cardMatch = line.match(
        /^(.+?)\s*[·•|]\s*(united states\s*\(\s*remote\s*\)|remote(?:,\s*us)?|hybrid|[A-Za-z .'-]+,\s*[A-Z]{2})$/i,
      );
      if (!cardMatch) continue;

      const possibleCompany = sanitizeCompany(cardMatch[1]);
      const possibleLocation = extractLocation(cardMatch[2]);
      if (!possibleCompany || possibleCompany.toLowerCase() !== subjectCompany.toLowerCase()) continue;

      bodyCompany = possibleCompany;
      location = possibleLocation ?? location;

      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const possibleRole = sanitizeRole(lines[previous]);
        if (!possibleRole) continue;
        if (possibleRole.toLowerCase() === subjectCompany.toLowerCase()) continue;
        if (/^(view job|application sent|your application)$/i.test(possibleRole)) continue;
        role = possibleRole;
        break;
      }
    }
  }

  return {
    company: bodyCompany ?? subjectCompany,
    role,
    location,
    reason: role || location ? "LinkedIn body parser" : "LinkedIn subject parser",
  };
}

function parseRoleAtCompanySubject(subject: string): ExtractedFields | null {
  const patterns = [
    /thank you for applying for\s+(?:the\s+)?(.+?)\s+(?:role|position)\s+at\s+(.+?)(?:[.!?]|$)/i,
    /thanks for applying for\s+(?:the\s+)?(.+?)\s+(?:role|position)\s+at\s+(.+?)(?:[.!?]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (!match?.[1] || !match?.[2]) continue;
    const role = sanitizeRole(match[1]);
    const company = sanitizeCompany(match[2]);
    if (role && company) {
      return {
        company,
        role,
        location: extractLocation(subject),
        reason: "Ashby role-at-company subject parser",
      };
    }
  }

  return null;
}

function extractCompanyFromSections(sections: TextSection[], sender: string) {
  const patterns = [
    /your application was sent to\s+([^.!?\n\r]+?)(?:[.!?]|$)/i,
    /thank you for applying to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /application to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /applying to\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /thanks for applying to\s+([A-Za-z0-9 &.-]+?)(?:[.!,:;]|$)/i,
    /interest in employment at\s+([A-Za-z0-9][A-Za-z0-9 &.-]{1,80})(?:[.!,:;]|$)/i,
    /your application to\s+([A-Za-z0-9 &.-]+?)(?:[.!,:;]|$)/i,
    /interview with\s+([A-Za-z0-9 &.-]+?)(?:[.!,:;]|$)/i,
  ];

  for (const section of sections) {
    const cleanedText = section.text.replace(/\r/g, "\n");
    for (const pattern of patterns) {
      const match = cleanedText.match(pattern);
      const candidate = sanitizeCompany(match?.[1]);
      if (candidate) return candidate;
    }
  }

  return extractCompanyFromSender(sender);
}

function extractRoleFromSections(sections: TextSection[]) {
  const patterns = [
    /indeed application:\s*([^\n\r.!?]+?)(?:[.!?]|\n|\r|$)/i,
    /(?:the\s+)?position\s+of\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,100}?)(?:\s+at\s+[A-Za-z0-9]|[.!,:;]|$)/i,
    /about\s+the\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,100}?)\s+position/i,
    /appl(?:y|ied)\s+to\s+the\s+position\s+for\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80}?)(?:[.!,:;]|$)/i,
    /position\s+for\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80}?)(?:[.!,:;]|$)/i,
    /application\s+for\s+([A-Za-z0-9][A-Za-z0-9 /,&()-]{1,80}?)(?:[.!,:;]|$)/i,
    /for the\s+([A-Za-z0-9 /,&()-]+?)\s+position/i,
    /your application for\s+([A-Za-z0-9 /,&()-]+?)(?:[.!,:;]|$)/i,
    /(software engineer|backend engineer|frontend engineer|new grad software engineer|data engineer)/i,
  ];

  for (const section of sections) {
    const cleaned = section.text.replace(/\r/g, "\n");
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      const candidate = sanitizeRole(match?.[1] ?? match?.[0]);
      if (candidate) return candidate;
    }
  }

  return null;
}

function extractLocationFromSections(sections: TextSection[]) {
  for (const section of sections) {
    const location = extractLocation(section.text);
    if (location) return location;
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

function selectExtraction(input: ClassifierInput, sections: TextSection[]) {
  const senderLower = input.sender.toLowerCase();
  const subject = sections.find((section) => section.label === "subject")?.text ?? "";

  const linkedInExtraction = parseLinkedInApplication(input.sender, sections);
  if (linkedInExtraction) return linkedInExtraction;

  const roleAtCompany = parseRoleAtCompanySubject(subject);
  if (roleAtCompany) return roleAtCompany;

  const joinedText = sections.map((section) => section.text).join("\n");
  const isIndeedSender = senderLower.includes("indeed.com") || senderLower.includes("indeed apply");
  const indeedCompany = isIndeedSender ? extractIndeedCompany(joinedText) : null;

  return {
    company: indeedCompany ?? extractCompanyFromSections(sections, input.sender),
    role: extractRoleFromSections(sections),
    location: extractLocationFromSections(sections),
    reason: indeedCompany ? "Indeed parser" : input.bodyText ? "Body parser fallback" : "Generic application confirmation",
  };
}

export function classifyGmailMessage(input: ClassifierInput): ClassificationResult {
  const sections = createTextSections(input);
  const merged = sections.map((section) => section.text).join("\n").toLowerCase();
  const sourceText = sections.map((section) => section.text).join("\n");
  const senderLower = input.sender.toLowerCase();
  const extraction = selectExtraction(input, sections);

  const company = extraction.company ?? "";
  const role = extraction.role;
  const location = extraction.location;

  const hasStrongApplicationSignal =
    includesAny(merged, newApplicationPhrases) ||
    includesAny(merged, rejectionPhrases) ||
    includesAny(merged, interviewPhrases) ||
    includesAny(merged, taskPhrases) ||
    includesAny(merged, strongOfferPhrases) ||
    /your application was sent to\s+/i.test(sourceText) ||
    /thank you for applying for\s+.+?\s+(?:role|position)\s+at\s+/i.test(sourceText) ||
    /interest in employment at\s+/i.test(sourceText);

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

  if (looksLikeNewsletter && !hasStrongApplicationSignal) {
    return {
      type: ReviewItemType.unknown_job_related,
      confidence: 0.1,
      company,
      role,
      location,
      suggestedStatus: null,
      taskTitle: null,
      reason: "Newsletter/promotional content detected without strong application signal",
    };
  }

  if (hasConsumerVerificationSignals && (!hasJobContext || !hasStrongApplicationSignal)) {
    return {
      type: ReviewItemType.unknown_job_related,
      confidence: 0.1,
      company,
      role,
      location,
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
      location,
      suggestedStatus: null,
      taskTitle: null,
      reason: "Consumer finance/banking notification detected without job context",
    };
  }

  const isIndeedSender = senderLower.includes("indeed.com") || senderLower.includes("indeed apply");
  const hasIndeedApplicationSignals =
    isIndeedSender &&
    (/indeed application:\s*/i.test(sourceText) ||
      /application submitted/i.test(sourceText) ||
      /the following items were sent to\s+/i.test(sourceText));

  if (hasIndeedApplicationSignals) {
    return {
      type: ReviewItemType.new_application,
      confidence: 0.92,
      company: company || "Unknown Company",
      role,
      location,
      suggestedStatus: ApplicationStatus.Applied,
      taskTitle: null,
      reason: extraction.reason || "Indeed parser",
    };
  }

  const isLinkedInSender = senderLower.includes("linkedin.com");
  if (isLinkedInSender && /your application was sent to\s+/i.test(sourceText)) {
    return {
      type: ReviewItemType.new_application,
      confidence: 0.9,
      company,
      role,
      location,
      suggestedStatus: ApplicationStatus.Applied,
      taskTitle: null,
      reason: extraction.reason,
    };
  }

  if (/thank you for applying for\s+.+?\s+(?:role|position)\s+at\s+/i.test(sourceText)) {
    return {
      type: ReviewItemType.new_application,
      confidence: 0.93,
      company,
      role,
      location,
      suggestedStatus: ApplicationStatus.Applied,
      taskTitle: null,
      reason: extraction.reason,
    };
  }

  if (includesAny(merged, rejectionPhrases)) {
    return {
      type: ReviewItemType.status_update,
      confidence: 0.9,
      company,
      role,
      location,
      suggestedStatus: ApplicationStatus.Rejected,
      taskTitle: null,
      reason: extraction.reason || "Rejection phrase detected",
    };
  }

  if (includesAny(merged, newApplicationPhrases)) {
    return {
      type: ReviewItemType.new_application,
      confidence: 0.9,
      company,
      role,
      location,
      suggestedStatus: ApplicationStatus.Applied,
      taskTitle: null,
      reason: extraction.reason || "Application confirmation phrase detected",
    };
  }

  if (includesAny(merged, strongOfferPhrases)) {
    return {
      type: ReviewItemType.status_update,
      confidence: 0.88,
      company,
      role,
      location,
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
      location,
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
      location,
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
    location,
    suggestedStatus: null,
    taskTitle: null,
    reason: "Potentially job-related but low confidence",
  };
}

export const gmailScanQuery =
  'newer_than:7d ("thank you for applying" OR "application received" OR "application submitted" OR "we received your application" OR "your application has been submitted" OR "thank you for your interest" OR "we have received your resume" OR "we\'ve received your resume" OR "your resume has been received" OR "resume has been received" OR "received your resume" OR "reviewed by our recruiting team" OR "interest in employment at" OR "unfortunately" OR "we regret to inform you" OR "not selected" OR "next steps" OR "interview" OR "schedule a call" OR "task awaiting you" OR "action required" OR "complete your assessment" OR "candidate portal" OR "coding challenge")';

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

10) Sender: Indeed Apply <indeedapply@indeed.com>
    Subject/snippet: "Indeed Application: Data Engineer ... Application submitted ... KUBRA - Tempe, AZ ... The following items were sent to KUBRA."
    Expected: type=new_application, company="KUBRA", role="Data Engineer", location="Tempe, AZ", suggestedStatus=Applied.
    If company cannot be extracted confidently, keep it as "Unknown Company" (never "Indeed").

11) Sender: Rolfson Oil <noreply@applytojob.com>
    Subject/snippet: "Saad, we've received your resume ... interest in employment at Rolfson Oil ... reviewed by our recruiting team"
    Expected: type=new_application, company="Rolfson Oil", role=null, suggestedStatus=Applied, confidence around 0.9.

12) Sender: LinkedIn <jobs-noreply@linkedin.com>
    Subject: "Saad Salman, your application was sent to CareerXperts Consulting"
    Body/snippet lines: "Associate Software Engineer" / "CareerXperts Consulting · United States (Remote)"
    Expected: company="CareerXperts Consulting", role="Associate Software Engineer", location="United States (Remote)".

13) Sender: Ashby <notifications@ashbyhq.com>
    Subject: "Thank you for applying for the Infrastructure Administrator I, Cloud AI Role at Illumio!"
    Expected: company="Illumio", role="Infrastructure Administrator I, Cloud AI".
*/
