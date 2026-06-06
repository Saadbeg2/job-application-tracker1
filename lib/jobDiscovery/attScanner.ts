import { scoreDiscoveredJobFit } from "@/lib/jobFitScorer";
import http from "node:http";
import https from "node:https";
import {
  getConfidence,
  inferWorkMode,
  normalizeJobUrl,
  rejectByDetail,
  rejectByTitleOrLocation,
  stripHtml,
} from "./filters";
import type { ParsedJobCard, ParsedJobDetail, ScanCareerPageResult, ScanPreviewJob } from "./types";

const ATT_BASE_URL = "https://www.att.jobs";
const MAX_SEARCH_PAGES_PER_URL = 4;
const MAX_DETAIL_FETCHES = 18;

const technologySearchUrl =
  "https://www.att.jobs/search-jobs?acm=ALL&alrpm=ALL&ascf=%5B%7B%22key%22%3A%22custom_fields.AJDGroup%22%2C%22value%22%3A%22Technology%22%7D%5D";

const earlyCareersSearchUrl = "https://www.att.jobs/search-jobs?acm=29177&alrpm=ALL";

async function fetchPublicHtml(url: string, redirectsRemaining = 4): Promise<string> {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = client.request(
      parsedUrl,
      {
        method: "GET",
        maxHeaderSize: 128 * 1024,
        headers: {
          "User-Agent": "JobApplicationTracker/1.0 (+local preview scanner)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location && redirectsRemaining > 0) {
          response.resume();
          resolve(fetchPublicHtml(new URL(location, parsedUrl).toString(), redirectsRemaining - 1));
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Failed to fetch ${url}: ${statusCode}`));
          return;
        }

        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      },
    );

    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timed out fetching ${url}`));
    });
    request.end();
  });
}

function htmlDecode(value: string) {
  return stripHtml(value);
}

function getPagedUrl(baseUrl: string, page: number) {
  const url = new URL(baseUrl);
  if (page > 1) url.searchParams.set("p", String(page));
  return url.toString();
}

function parseTotalPages(html: string) {
  const match = html.match(/data-total-pages="(\d+)"/i);
  return match ? Number(match[1]) : 1;
}

function parseJobCards(html: string): ParsedJobCard[] {
  const cards: ParsedJobCard[] = [];
  const listItemPattern = /<li>\s*<div class="section8__content">([\s\S]*?)<\/li>/gi;

  for (const itemMatch of html.matchAll(listItemPattern)) {
    const itemHtml = itemMatch[1];
    const linkMatch = itemHtml.match(/<h2 class="headline__small">\s*<a href="([^"]+)" data-job-id="([^"]+)">([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const locationMatch = itemHtml.match(/<span class="job-location">([\s\S]*?)<\/span>/i);
    const title = htmlDecode(linkMatch[3]);
    const location = locationMatch ? htmlDecode(locationMatch[1]) : null;
    const jobUrl = normalizeJobUrl(linkMatch[1], ATT_BASE_URL);

    cards.push({
      title,
      location,
      jobUrl,
      jobId: linkMatch[2],
    });
  }

  return cards;
}

function extractJsonLdJobPosting(html: string): ParsedJobDetail | null {
  const scripts = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]) as {
        "@type"?: string;
        title?: string;
        description?: string;
        url?: string;
        identifier?: string;
        jobLocation?: Array<{
          address?: {
            addressLocality?: string;
            addressRegion?: string;
            addressCountry?: string;
          };
        }>;
      };

      if (parsed["@type"] !== "JobPosting" || !parsed.title) continue;

      const address = parsed.jobLocation?.[0]?.address;
      const locationParts = [address?.addressLocality, address?.addressRegion].filter(Boolean);
      const location = address?.addressCountry && address.addressCountry !== "United States"
        ? [...locationParts, address.addressCountry].join(", ")
        : locationParts.join(", ") || null;

      return {
        title: htmlDecode(parsed.title),
        location,
        description: stripHtml(parsed.description ?? ""),
        jobId: parsed.identifier ?? null,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function extractApplyUrl(html: string) {
  const match = html.match(/data-apply-url="([^"]+)"/i) ?? html.match(/<a[^>]+class="[^"]*job-apply[^"]*"[^>]+href="([^"]+)"/i);
  return match ? htmlDecode(match[1]) : null;
}

function parseJobDetail(html: string, fallback: ParsedJobCard): ParsedJobDetail {
  const jsonLd = extractJsonLdJobPosting(html);
  if (jsonLd) {
    return {
      ...jsonLd,
      title: jsonLd.title || fallback.title,
      location: jsonLd.location || fallback.location,
      applyUrl: extractApplyUrl(html),
    };
  }

  const titleMatch = html.match(/<h1 class="headline__medium">([\s\S]*?)<\/h1>/i);
  const descriptionMatch = html.match(/<div class="ats-description">([\s\S]*?)<\/div>\s*<span class="job-id/i);
  const locationMatch = html.match(/<b>Location:<\/b>\s*<\/p>\s*([^<]+)/i);

  return {
    title: titleMatch ? htmlDecode(titleMatch[1]) : fallback.title,
    location: locationMatch ? htmlDecode(locationMatch[1]) : fallback.location,
    description: descriptionMatch ? stripHtml(descriptionMatch[1]) : stripHtml(html),
    applyUrl: extractApplyUrl(html),
    jobId: fallback.jobId ?? null,
  };
}

function toPreviewJob(companyName: string, card: ParsedJobCard, detail: ParsedJobDetail): ScanPreviewJob {
  const description = detail.description.slice(0, 3000);
  const workMode = inferWorkMode(`${card.location ?? ""} ${description}`);
  const fit = scoreDiscoveredJobFit({
    companyName,
    title: detail.title,
    location: detail.location ?? card.location,
    workMode,
    description,
  });

  return {
    companyName,
    title: detail.title,
    location: detail.location ?? card.location,
    workMode,
    jobUrl: card.jobUrl,
    description,
    fitScore: fit.fitScore,
    fitReason: fit.fitReason,
    confidence: getConfidence(fit.fitScore, detail.title, description),
  };
}

async function collectAttJobCards(searchUrl: string) {
  const cards: ParsedJobCard[] = [];
  let totalPages = MAX_SEARCH_PAGES_PER_URL;

  for (let page = 1; page <= Math.min(totalPages, MAX_SEARCH_PAGES_PER_URL); page += 1) {
    const html = await fetchPublicHtml(getPagedUrl(searchUrl, page));
    totalPages = Math.max(1, parseTotalPages(html));
    cards.push(...parseJobCards(html));
  }

  return cards;
}

export async function scanAttCareerPage(companyName: string, careerPageUrl: string): Promise<ScanCareerPageResult> {
  await fetchPublicHtml(careerPageUrl);

  const searchUrls = [technologySearchUrl, earlyCareersSearchUrl];
  const cards = (await Promise.all(searchUrls.map(collectAttJobCards))).flat();
  const uniqueCards = new Map<string, ParsedJobCard>();

  for (const card of cards) {
    uniqueCards.set(card.jobUrl, card);
  }

  const possibleMatches: ScanPreviewJob[] = [];
  let detailFetches = 0;

  for (const card of uniqueCards.values()) {
    const quickReject = rejectByTitleOrLocation(card.title, card.location);
    if (quickReject.rejected) continue;
    if (detailFetches >= MAX_DETAIL_FETCHES) break;

    detailFetches += 1;
    const detailHtml = await fetchPublicHtml(card.jobUrl);
    const detail = parseJobDetail(detailHtml, card);
    const fullReject = rejectByDetail(detail.title, detail.location ?? card.location, detail.description);
    if (fullReject.rejected) continue;

    possibleMatches.push(toPreviewJob(companyName, card, detail));
  }

  possibleMatches.sort((a, b) => b.fitScore - a.fitScore || a.title.localeCompare(b.title));

  console.info("[job-discovery] AT&T scan preview", {
    careerPageUrl,
    jobsScanned: uniqueCards.size,
    detailFetches,
    possibleMatches: possibleMatches.length,
  });

  return {
    companyName,
    careerPageUrl,
    sourceType: "att",
    jobsScanned: uniqueCards.size,
    possibleMatches,
  };
}
