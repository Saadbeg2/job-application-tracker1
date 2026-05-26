export type JobFitInput = {
  companyName: string;
  title: string;
  description?: string | null;
  location?: string | null;
  workMode?: "Remote" | "Hybrid" | "OnSite" | "Unknown" | null;
};

export type JobFitResult = {
  fitScore: number;
  fitReason: string;
};

const positiveKeywords: Array<{ phrase: string; points: number }> = [
  { phrase: "entry level", points: 14 },
  { phrase: "junior", points: 12 },
  { phrase: "associate", points: 10 },
  { phrase: "new grad", points: 14 },
  { phrase: "software engineer", points: 12 },
  { phrase: "cloud support", points: 12 },
  { phrase: "technical support", points: 10 },
  { phrase: "it analyst", points: 10 },
  { phrase: "data analyst", points: 10 },
  { phrase: "support engineer", points: 9 },
  { phrase: "implementation analyst", points: 9 },
  { phrase: "database administrator", points: 8 },
  { phrase: "sql", points: 7 },
  { phrase: "python", points: 7 },
  { phrase: "aws", points: 8 },
  { phrase: "linux", points: 7 },
  { phrase: "networking", points: 7 },
  { phrase: "troubleshooting", points: 7 },
  { phrase: "customer support", points: 6 },
  { phrase: "systems", points: 5 },
  { phrase: "terraform", points: 4 },
  { phrase: "cloudformation", points: 4 },
];

const negativeKeywords: Array<{ phrase: string; points: number }> = [
  { phrase: "senior", points: -14 },
  { phrase: "staff", points: -16 },
  { phrase: "principal", points: -18 },
  { phrase: "lead", points: -10 },
  { phrase: "manager", points: -18 },
  { phrase: "director", points: -22 },
  { phrase: "architect", points: -14 },
  { phrase: "5+ years", points: -14 },
  { phrase: "7+ years", points: -18 },
  { phrase: "10+ years", points: -22 },
  { phrase: "active clearance required", points: -20 },
  { phrase: "phd required", points: -16 },
  { phrase: "postdoctoral", points: -20 },
  { phrase: "board certified", points: -24 },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function contains(text: string, phrase: string) {
  return text.includes(phrase.toLowerCase());
}

export function scoreDiscoveredJobFit(input: JobFitInput): JobFitResult {
  const merged = `${input.companyName} ${input.title} ${input.description ?? ""}`.toLowerCase();

  let score = 50;
  const hits: string[] = [];
  const misses: string[] = [];

  for (const rule of positiveKeywords) {
    if (contains(merged, rule.phrase)) {
      score += rule.points;
      hits.push(rule.phrase);
    }
  }

  for (const rule of negativeKeywords) {
    if (contains(merged, rule.phrase)) {
      score += rule.points;
      misses.push(rule.phrase);
    }
  }

  const fitScore = clampScore(score);

  const reasonParts: string[] = [];
  if (hits.length > 0) {
    const topHits = hits.slice(0, 4).join(", ");
    reasonParts.push(`Strong matches found: ${topHits}.`);
  }
  if (misses.length > 0) {
    const topMisses = misses.slice(0, 2).join(", ");
    reasonParts.push(`Potential mismatch signals: ${topMisses}.`);
  }
  if (reasonParts.length === 0) {
    reasonParts.push(
      "Moderate baseline fit based on your CS background and general interest areas; review details before applying.",
    );
  }

  return {
    fitScore,
    fitReason: reasonParts.join(" "),
  };
}
