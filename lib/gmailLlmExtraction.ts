import { ApplicationStatus, ReviewItemType } from "@prisma/client";
import type { ClassificationResult } from "@/lib/gmailClassifier";

type LlmExtractionInput = {
  sender: string;
  subject: string;
  bodyText: string;
};

type RawLlmExtraction = {
  company: string | null;
  role: string | null;
  location: string | null;
  type: string;
  suggestedStatus: string | null;
  confidence: number;
  reason: string;
};

export type HybridExtractionResult = {
  result: ClassificationResult;
  extractionMethod: string;
  extractionReason: string;
};

const platformCompanyNames = new Set([
  "linkedin",
  "indeed",
  "workday",
  "ashby",
  "gmail",
  "google",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "icims",
]);

const bodyCutoffMarkers = [
  "View similar jobs",
  "Recommended for you",
  "You might also like",
  "Similar jobs",
  "People also viewed",
];

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanCandidate(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/[!:;,]+$/g, "")
    .trim();
  const lower = cleaned.toLowerCase();

  if (!cleaned || cleaned.length > maxLength) return null;
  if (cleaned.includes("---")) return null;
  if (/\b(your application was sent|thank you for applying|recommended for you|view similar jobs)\b/i.test(cleaned)) {
    return null;
  }
  if (cleaned.split(/\s+/).length > 10 && /\b(application|received|submitted|thank|interest)\b/i.test(cleaned)) {
    return null;
  }
  if (platformCompanyNames.has(lower)) return null;

  return cleaned;
}

function isSupportedType(value: string): value is ReviewItemType {
  return Object.values(ReviewItemType).includes(value as ReviewItemType);
}

function isSupportedStatus(value: string | null): value is ApplicationStatus | null {
  if (value === null) return true;
  return Object.values(ApplicationStatus).includes(value as ApplicationStatus);
}

function parseResponseText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }

  return null;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function validateRawExtraction(value: unknown): RawLlmExtraction | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const type = optionalText(candidate.type);
  const suggestedStatus = candidate.suggestedStatus === null ? null : optionalText(candidate.suggestedStatus);
  const confidence = typeof candidate.confidence === "number" ? candidate.confidence : null;
  const reason = optionalText(candidate.reason);

  if (!type || !isSupportedType(type)) return null;
  if (!isSupportedStatus(suggestedStatus)) return null;
  if (confidence === null || confidence < 0 || confidence > 1) return null;
  if (!reason) return null;

  return {
    company: candidate.company === null ? null : optionalText(candidate.company),
    role: candidate.role === null ? null : optionalText(candidate.role),
    location: candidate.location === null ? null : optionalText(candidate.location),
    type,
    suggestedStatus,
    confidence,
    reason,
  };
}

function textContainsField(source: string, field: string | null) {
  if (!field) return false;
  return source.toLowerCase().includes(field.toLowerCase());
}

export function prepareEmailBodyForLlm(bodyText: string, maxChars = 2000) {
  let cleaned = bodyText
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lower = cleaned.toLowerCase();
  const cutoffIndexes = bodyCutoffMarkers
    .map((marker) => lower.indexOf(marker.toLowerCase()))
    .filter((index) => index >= 0);

  if (cutoffIndexes.length > 0) {
    cleaned = cleaned.slice(0, Math.min(...cutoffIndexes)).trim();
  }

  return cleaned.slice(0, maxChars);
}

function isLlmEligibleType(type: ReviewItemType) {
  return (
    type === ReviewItemType.new_application ||
    type === ReviewItemType.status_update ||
    type === ReviewItemType.task
  );
}

export function shouldUseLlmFallback(classified: ClassificationResult) {
  if (classified.confidence <= 0.2) return false;
  if (!isLlmEligibleType(classified.type)) {
    return false;
  }

  return (
    classified.confidence < 0.8 ||
    !classified.company ||
    classified.company === "Unknown Company" ||
    !classified.role
  );
}

async function callOpenAiFallback(input: LlmExtractionInput) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.LLM_MODEL?.trim() || "gpt-4.1-mini";
  const prompt = [
    "Extract job-application review fields from this email.",
    "Use only information explicitly present in sender, subject, or cleaned body text.",
    "Do not guess or infer. If a field is not clearly present, return null.",
    "Do not extract recommended/similar jobs as the actual application.",
    "Return only strict JSON matching the schema.",
    "",
    `Sender: ${input.sender}`,
    `Subject: ${input.subject}`,
    "Cleaned body:",
    input.bodyText,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You extract structured fields for a job application tracker review queue. Return strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "gmail_review_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              company: { type: ["string", "null"] },
              role: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              type: {
                type: "string",
                enum: ["new_application", "status_update", "task", "unknown_job_related"],
              },
              suggestedStatus: {
                type: ["string", "null"],
                enum: ["Applied", "Interview", "Rejected", "Offer", "Withdrawn", null],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" },
            },
            required: ["company", "role", "location", "type", "suggestedStatus", "confidence", "reason"],
          },
        },
      },
    }),
  });

  if (!response.ok) return null;

  const text = parseResponseText(await response.json());
  if (!text) return null;

  return validateRawExtraction(safeJsonParse(text));
}

function mergeLlmResult(ruleResult: ClassificationResult, llmResult: RawLlmExtraction, explicitText: string) {
  const llmCompany = cleanCandidate(llmResult.company, 80);
  const llmRole = cleanCandidate(llmResult.role, 120);
  const llmLocation = cleanCandidate(llmResult.location, 80);

  const ruleCompanyIsStrong =
    Boolean(ruleResult.company) &&
    ruleResult.company !== "Unknown Company" &&
    ruleResult.confidence >= 0.85;

  const company =
    ruleCompanyIsStrong && llmCompany && llmCompany.toLowerCase() !== ruleResult.company.toLowerCase()
      ? ruleResult.company
      : ruleResult.company || (textContainsField(explicitText, llmCompany) ? llmCompany : null) || "";

  const role = ruleResult.role || (textContainsField(explicitText, llmRole) ? llmRole : null);
  const location = ruleResult.location || (textContainsField(explicitText, llmLocation) ? llmLocation : null);
  const type = llmResult.type === "unknown_job_related" ? ruleResult.type : (llmResult.type as ReviewItemType);
  const suggestedStatus = ruleResult.suggestedStatus ?? llmResult.suggestedStatus;
  const confidence = company && role ? Math.max(ruleResult.confidence, Math.min(llmResult.confidence, 0.9)) : Math.min(ruleResult.confidence, 0.79);

  return {
    type,
    confidence,
    company,
    role,
    location,
    suggestedStatus,
    taskTitle: ruleResult.taskTitle,
    reason: llmResult.reason,
  };
}

export async function runLlmExtractionFallback(
  ruleResult: ClassificationResult,
  input: LlmExtractionInput,
): Promise<HybridExtractionResult> {
  if (process.env.LLM_ENABLED?.trim().toLowerCase() !== "true") {
    return {
      result: ruleResult,
      extractionMethod: ruleResult.reason.startsWith("LinkedIn")
        ? "rule:linkedin_subject"
        : ruleResult.reason.startsWith("Ashby")
          ? "rule:ashby_subject"
          : "rule",
      extractionReason: ruleResult.reason,
    };
  }

  const cleanedBody = prepareEmailBodyForLlm(input.bodyText);
  if (!cleanedBody || !shouldUseLlmFallback(ruleResult)) {
    return {
      result: ruleResult,
      extractionMethod: ruleResult.reason.startsWith("LinkedIn")
        ? "rule:linkedin_subject"
        : ruleResult.reason.startsWith("Ashby")
          ? "rule:ashby_subject"
          : "rule",
      extractionReason: ruleResult.reason,
    };
  }

  const llmResult = await callOpenAiFallback({ ...input, bodyText: cleanedBody });
  if (!llmResult) {
    return {
      result: ruleResult,
      extractionMethod: "rule",
      extractionReason: `${ruleResult.reason}; LLM fallback unavailable or invalid`,
    };
  }

  const merged = mergeLlmResult(
    ruleResult,
    llmResult,
    `${input.sender}\n${input.subject}\n${cleanedBody}`,
  );

  const filledFields = [
    !ruleResult.role && merged.role ? "role" : null,
    !ruleResult.location && merged.location ? "location" : null,
    (!ruleResult.company || ruleResult.company === "Unknown Company") && merged.company ? "company" : null,
  ].filter(Boolean);

  return {
    result: merged,
    extractionMethod: filledFields.length > 0 ? "hybrid:rule_plus_llm" : "llm_fallback",
    extractionReason:
      filledFields.length > 0
        ? `Rule extraction kept; ${filledFields.join("/")} filled by LLM fallback from cleaned body. ${llmResult.reason}`
        : `LLM fallback checked cleaned body; rule extraction retained. ${llmResult.reason}`,
  };
}
