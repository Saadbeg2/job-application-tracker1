import { scoreDiscoveredJobFit } from "@/lib/jobFitScorer";
import {
  getConfidence,
  inferWorkMode,
  rejectByDetail,
  rejectByTitleOrLocation,
  stripHtml,
} from "./filters";
import type { JobDiscoveryWorkMode, ScanCareerPageResult, ScanPreviewJob } from "./types";

const ORACLE_JOB_SEARCH_URL = "https://careers.oracle.com/en/sites/jobsearch";
const ORACLE_LISTING_ENDPOINT =
  "https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";
const ORACLE_DETAIL_ENDPOINT =
  "https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails";
const ORACLE_SITE_NUMBER = "CX_45001";
const UNITED_STATES_LOCATION_FACET = "300000000149325";
const SEARCH_LIMIT = 25;
const MAX_PAGES_PER_KEYWORD = 2;
const MAX_DETAIL_FETCHES = 40;

const technicalKeywords = ["software", "cloud", "data", "IT", "systems", "network", "support", "developer"];

type OracleListingResponse = {
  items?: OracleSearchResult[];
};

type OracleSearchResult = {
  TotalJobsCount?: number;
  requisitionList?: OracleJobListing[];
};

type OracleJobListing = {
  Id?: string | number | null;
  Title?: string | null;
  PrimaryLocation?: string | null;
  PrimaryLocationCountry?: string | null;
  ShortDescriptionStr?: string | null;
  WorkplaceType?: string | null;
  PostedDate?: string | null;
};

type OracleDetailResponse = {
  items?: OracleJobDetail[];
};

type OracleJobDetail = {
  Id?: string | number | null;
  Title?: string | null;
  Category?: string | null;
  RequisitionType?: string | null;
  ExternalPostedStartDate?: string | null;
  PrimaryLocation?: string | null;
  PrimaryLocationCountry?: string | null;
  WorkplaceType?: string | null;
  ShortDescriptionStr?: string | null;
  ExternalDescriptionStr?: string | null;
  ExternalQualificationsStr?: string | null;
  ExternalResponsibilitiesStr?: string | null;
  requisitionFlexFields?: unknown;
  secondaryLocations?: unknown;
  workLocation?: unknown;
  otherWorkLocations?: unknown;
};

type OraclePreviewCandidate = {
  id: string;
  title: string;
  location: string | null;
  country: string | null;
  workplaceType: string | null;
  jobUrl: string;
  shortDescription: string;
};

function cleanText(value: string | null | undefined) {
  return stripHtml(value ?? "");
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(stringifyValue).filter(Boolean).join(" ");
  }
  return "";
}

function getOracleJobUrl(jobId: string) {
  return `${ORACLE_JOB_SEARCH_URL}/job/${encodeURIComponent(jobId)}`;
}

function buildListingUrl(keyword: string, offset: number) {
  const url = new URL(ORACLE_LISTING_ENDPOINT);
  url.searchParams.set(
    "finder",
    [
      `findReqs;siteNumber=${ORACLE_SITE_NUMBER}`,
      `keyword=${keyword}`,
      `selectedLocationsFacet=${UNITED_STATES_LOCATION_FACET}`,
      "sortBy=POSTING_DATES_DESC",
      `limit=${SEARCH_LIMIT}`,
      `offset=${offset}`,
    ].join(","),
  );
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("expand", "requisitionList");
  return url;
}

function buildDetailUrl(jobId: string) {
  const url = new URL(ORACLE_DETAIL_ENDPOINT);
  url.searchParams.set("finder", `ById;Id="${jobId}",siteNumber=${ORACLE_SITE_NUMBER}`);
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("expand", "all");
  return url;
}

async function fetchOracleJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "JobApplicationTracker/1.0 (+local preview scanner)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Oracle request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function isUsJob(country: string | null, location: string | null) {
  const normalizedCountry = (country ?? "").trim().toLowerCase();
  if (normalizedCountry === "us" || normalizedCountry === "usa" || normalizedCountry === "united states") return true;
  if (normalizedCountry) return false;

  const normalizedLocation = (location ?? "").toLowerCase();
  return /\bunited states\b|\bu\.?s\.?\b|\busa\b/.test(normalizedLocation);
}

function hasOracleTitleReject(title: string) {
  return /\bintern(?:ship)?s?\b|\bintern conversion\b|\bco[-\s]?op\b|\bsenior\b|\bsr\.?\b|\bstaff\b|\bprincipal\b|\blead\b|\bmanager\b|\bmgr\b|\bdirector\b|\bgovernment\b|\bclearance\b|\bts\/sci\b|\bpolygraph\b/i.test(
    title,
  );
}

function hasDisqualifyingOracleFlexField(flexText: string) {
  const normalized = flexText.toLowerCase();
  if (/\bclearance\b.{0,80}\byes\b|\byes\b.{0,80}\bclearance\b|\bts\/sci\b|\bpolygraph\b/.test(normalized)) {
    return true;
  }

  return /\b(?:3|4|5|6|7|8|9|10)\s*(?:\+|plus)?\s*(?:to\s*(?:5|6|7|8|9|10)\s*\+?)?\s*years?\b/.test(
    normalized,
  );
}

function sentenceHasDisqualifyingExperience(sentence: string) {
  const normalized = sentence.toLowerCase();
  if (/\bpreferred\b|\bnice[-\s]?to[-\s]?have\b|\bfamiliarity with\b/.test(normalized)) return false;
  return /\b(?:3|4|5|6|7|8|9|10)\s*(?:\+|plus)?\s*(?:to\s*(?:5|6|7|8|9|10)\s*\+?)?\s*years?\b/.test(
    normalized,
  );
}

function hasRequiredExperienceInDetail(description: string) {
  return description
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .some(sentenceHasDisqualifyingExperience);
}

function shouldRejectListing(candidate: OraclePreviewCandidate) {
  if (!isUsJob(candidate.country, candidate.location)) return true;
  if (hasOracleTitleReject(candidate.title)) return true;

  const genericReject = rejectByTitleOrLocation(candidate.title, null);
  return genericReject.rejected;
}

function shouldRejectDetail(title: string, description: string, country: string | null) {
  if (!isUsJob(country, "United States")) return true;
  if (hasOracleTitleReject(title)) return true;

  const genericReject = rejectByDetail(title, null, description);
  if (genericReject.rejected) return true;

  return hasRequiredExperienceInDetail(description);
}

function parseListing(listing: OracleJobListing): OraclePreviewCandidate | null {
  const id = listing.Id === null || listing.Id === undefined ? "" : String(listing.Id).trim();
  const title = cleanText(listing.Title).trim();
  if (!id || !title) return null;

  return {
    id,
    title,
    location: cleanText(listing.PrimaryLocation) || null,
    country: cleanText(listing.PrimaryLocationCountry) || null,
    workplaceType: cleanText(listing.WorkplaceType) || null,
    jobUrl: getOracleJobUrl(id),
    shortDescription: cleanText(listing.ShortDescriptionStr),
  };
}

function getDetailDescription(detail: OracleJobDetail, candidate: OraclePreviewCandidate) {
  const flexText = stringifyValue(detail.requisitionFlexFields);
  const locationText = stringifyValue(detail.secondaryLocations) + " " + stringifyValue(detail.otherWorkLocations);
  const parts = [
    detail.Category,
    detail.RequisitionType,
    detail.ShortDescriptionStr,
    detail.ExternalDescriptionStr,
    detail.ExternalQualificationsStr,
    detail.ExternalResponsibilitiesStr,
    flexText,
    locationText,
    candidate.shortDescription,
  ];

  return stripHtml(parts.filter(Boolean).join(" "));
}

function getWorkMode(candidate: OraclePreviewCandidate, detail: OracleJobDetail, description: string): JobDiscoveryWorkMode {
  return inferWorkMode(
    [
      candidate.workplaceType,
      detail.WorkplaceType,
      detail.PrimaryLocation,
      stringifyValue(detail.workLocation),
      stringifyValue(detail.otherWorkLocations),
      description,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function toPreviewJob(companyName: string, candidate: OraclePreviewCandidate, detail: OracleJobDetail): ScanPreviewJob {
  const title = cleanText(detail.Title) || candidate.title;
  const location = cleanText(detail.PrimaryLocation) || candidate.location;
  const description = getDetailDescription(detail, candidate).slice(0, 3000);
  const workMode = getWorkMode(candidate, detail, description);
  const fit = scoreDiscoveredJobFit({
    companyName,
    title,
    location,
    workMode,
    description,
  });

  return {
    companyName,
    title,
    location,
    workMode,
    jobUrl: candidate.jobUrl,
    description,
    fitScore: fit.fitScore,
    fitReason: fit.fitReason,
    confidence: getConfidence(fit.fitScore, title, description),
  };
}

async function collectOracleListings() {
  const candidates = new Map<string, OraclePreviewCandidate>();
  const scannedJobIds = new Set<string>();

  for (const keyword of technicalKeywords) {
    for (let page = 0; page < MAX_PAGES_PER_KEYWORD; page += 1) {
      const offset = page * SEARCH_LIMIT;
      const response = await fetchOracleJson<OracleListingResponse>(buildListingUrl(keyword, offset));
      const listings = response.items?.flatMap((item) => item.requisitionList ?? []) ?? [];

      for (const listing of listings) {
        const candidate = parseListing(listing);
        if (!candidate) continue;
        scannedJobIds.add(candidate.id);
        if (shouldRejectListing(candidate)) continue;
        candidates.set(candidate.id, candidate);
      }
    }
  }

  return {
    candidates,
    jobsScanned: scannedJobIds.size,
  };
}

async function fetchOracleDetail(jobId: string) {
  const response = await fetchOracleJson<OracleDetailResponse>(buildDetailUrl(jobId));
  return response.items?.[0] ?? null;
}

export async function scanOracleCareerPage(companyName: string, careerPageUrl: string): Promise<ScanCareerPageResult> {
  const { candidates, jobsScanned } = await collectOracleListings();
  const possibleMatches: ScanPreviewJob[] = [];
  let detailFetches = 0;

  for (const candidate of candidates.values()) {
    if (detailFetches >= MAX_DETAIL_FETCHES) break;

    detailFetches += 1;
    const detail = await fetchOracleDetail(candidate.id);
    if (!detail) continue;

    const title = cleanText(detail.Title) || candidate.title;
    const country = cleanText(detail.PrimaryLocationCountry) || candidate.country;
    const description = getDetailDescription(detail, candidate);
    const flexText = stringifyValue(detail.requisitionFlexFields);

    if (hasDisqualifyingOracleFlexField(flexText)) continue;
    if (shouldRejectDetail(title, description, country)) continue;

    possibleMatches.push(toPreviewJob(companyName, candidate, detail));
  }

  possibleMatches.sort((a, b) => b.fitScore - a.fitScore || a.title.localeCompare(b.title));

  console.info("[job-discovery] Oracle scan preview", {
    careerPageUrl,
    keywords: technicalKeywords,
    jobsScanned,
    quickPassCandidates: candidates.size,
    detailFetches,
    possibleMatches: possibleMatches.length,
  });

  return {
    companyName,
    careerPageUrl,
    sourceType: "oracle",
    jobsScanned,
    possibleMatches,
  };
}
