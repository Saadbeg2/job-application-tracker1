import type { JobDiscoveryConfidence, JobDiscoveryWorkMode, RejectResult } from "./types";

const usStatePattern = /\b(?:A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY]|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i;

const positiveSignals = [
  "entry level",
  "new grad",
  "junior",
  "associate",
  "technology development program",
  "software",
  "developer",
  "it ",
  "systems",
  "data",
  "cloud",
  "cybersecurity",
  "network",
  "technical analyst",
  "support engineer",
  "computer science",
  "stem",
  "information systems",
  "computer engineering",
  "software engineering",
  "data science",
];

const hardRejectTitlePatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bintern(?:ship)?s?\b/i, reason: "internship" },
  { pattern: /\bco[-\s]?op\b/i, reason: "co-op" },
  { pattern: /\bsenior\b/i, reason: "senior role" },
  { pattern: /\bstaff\b/i, reason: "staff role" },
  { pattern: /\bprincipal\b/i, reason: "principal role" },
  { pattern: /\blead\b/i, reason: "lead role" },
  { pattern: /\bmanager\b|\bmgr\b/i, reason: "manager role" },
  { pattern: /\bdirector\b|\bavp\b|\bvp\b/i, reason: "director or executive role" },
  { pattern: /\bgovernment\b/i, reason: "government role" },
  { pattern: /\bclearance\b|\bts\/sci\b|\bpolygraph\b/i, reason: "clearance role" },
];

const hardRejectDetailPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bintern(?:ship)?s?\b/i, reason: "internship" },
  { pattern: /\bco[-\s]?op\b/i, reason: "co-op" },
  { pattern: /\bgovernment\b/i, reason: "government role" },
  { pattern: /\bclearance\b|\bts\/sci\b|\bpolygraph\b/i, reason: "clearance role" },
];

const nonUsLocationPatterns = [
  /\bindia\b/i,
  /\bbengaluru\b/i,
  /\bbangalore\b/i,
  /\bhyderabad\b/i,
  /\bchennai\b/i,
  /\bmexico\b/i,
  /\bslovakia\b/i,
  /\bczech\b/i,
  /\bphilippines\b/i,
  /\bpoland\b/i,
  /\bcanada\b/i,
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sentenceRejectsExperience(sentence: string) {
  const lower = sentence.toLowerCase();
  if (/\bpreferred\b|\bnice[-\s]?to[-\s]?have\b|\bfamiliarity with\b/.test(lower)) {
    return false;
  }

  const hasRequiredLanguage = /\brequired\b|\brequirement\b|\bminimum\b|\bat least\b|\bmust\b|\bneed(?:s|ed)?\b/.test(lower);
  if (!hasRequiredLanguage) return false;

  return /(?:3|4|5|6|7|8|9|10)\s*(?:\+|plus)?\s*(?:or more\s*)?years?/.test(lower);
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2011;|&#8209;/gi, "-")
    .replace(/&#x2013;|&#8211;/gi, "-")
    .replace(/&#x2014;|&#8212;/gi, "-")
    .replace(/&#x2019;|&#8217;/gi, "'")
    .replace(/&#x201C;|&#8220;/gi, '"')
    .replace(/&#x201D;|&#8221;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeJobUrl(rawUrl: string, baseUrl: string) {
  const url = new URL(rawUrl, baseUrl);
  url.hash = "";
  url.search = "";
  return url.toString();
}

export function inferWorkMode(text: string): JobDiscoveryWorkMode {
  const lower = text.toLowerCase();
  if (/\bremote\b/.test(lower)) return "Remote";
  if (/\bhybrid\b/.test(lower)) return "Hybrid";
  if (/\bon[-\s]?site\b|\bin office\b/.test(lower)) return "OnSite";
  return "Unknown";
}

export function rejectByTitleOrLocation(title: string, location: string | null): RejectResult {
  for (const rule of hardRejectTitlePatterns) {
    if (rule.pattern.test(title)) return { rejected: true, reason: rule.reason };
  }

  if (location) {
    for (const pattern of nonUsLocationPatterns) {
      if (pattern.test(location)) return { rejected: true, reason: "non-U.S. location" };
    }

    const lowerLocation = location.toLowerCase();
    const isRemoteUs = /\bremote\b/.test(lowerLocation) && /\b(?:u\.?s\.?|united states|usa)\b/.test(lowerLocation);
    const hasUsState = usStatePattern.test(location);
    if (!isRemoteUs && !hasUsState) {
      return { rejected: true, reason: "location is not clearly U.S.-based" };
    }
  }

  return { rejected: false };
}

export function rejectByDetail(title: string, location: string | null, description: string): RejectResult {
  const combined = `${title} ${location ?? ""} ${description}`;

  for (const rule of hardRejectDetailPatterns) {
    if (rule.pattern.test(combined)) return { rejected: true, reason: rule.reason };
  }

  if (/\b(?:5|7|10)\s*(?:\+|plus)?\s*(?:or more\s*)?years?\b/i.test(combined)) {
    return { rejected: true, reason: "experience requirement is too high" };
  }

  const sentence = splitSentences(description).find(sentenceRejectsExperience);
  if (sentence) {
    return { rejected: true, reason: "3+ years required" };
  }

  return rejectByTitleOrLocation(title, location);
}

export function hasPositiveSignal(title: string, description: string) {
  const lower = `${title} ${description}`.toLowerCase();
  return positiveSignals.some((signal) => lower.includes(signal));
}

export function getConfidence(fitScore: number, title: string, description: string): JobDiscoveryConfidence {
  if (fitScore >= 75) return "high";
  if (fitScore >= 58 || hasPositiveSignal(title, description)) return "medium";
  return "low";
}
