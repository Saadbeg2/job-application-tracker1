import { scanAttCareerPage } from "./attScanner";
import { scanOracleCareerPage } from "./oracleScanner";
import type { ScanCareerPageInput, ScanCareerPageResult } from "./types";

function detectSourceType(careerPageUrl: string) {
  try {
    const url = new URL(careerPageUrl);
    if (url.hostname === "att.jobs" || url.hostname.endsWith(".att.jobs")) return "att";
    const isOracleHost = url.hostname === "oracle.com" || url.hostname.endsWith(".oracle.com");
    if (isOracleHost && url.href.toLowerCase().includes("career")) return "oracle";
  } catch {
    return "generic";
  }

  return "generic";
}

export async function scanCareerPage(input: ScanCareerPageInput): Promise<ScanCareerPageResult> {
  const companyName = input.companyName.trim();
  const careerPageUrl = input.careerPageUrl.trim();
  const sourceType = detectSourceType(careerPageUrl);

  if (sourceType === "att") {
    return scanAttCareerPage(companyName, careerPageUrl);
  }

  if (sourceType === "oracle") {
    return scanOracleCareerPage(companyName, careerPageUrl);
  }

  return {
    companyName,
    careerPageUrl,
    sourceType: "generic",
    jobsScanned: 0,
    possibleMatches: [],
    message: "Generic career page scanning is not implemented yet. This preview currently supports AT&T and Oracle pages only.",
  };
}
