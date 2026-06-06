export type JobDiscoverySourceType = "att" | "oracle" | "generic";

export type JobDiscoveryWorkMode = "Remote" | "Hybrid" | "OnSite" | "Unknown";

export type JobDiscoveryConfidence = "high" | "medium" | "low";

export type ScanPreviewJob = {
  companyName: string;
  title: string;
  location: string | null;
  workMode: JobDiscoveryWorkMode;
  jobUrl: string;
  description: string | null;
  fitScore: number;
  fitReason: string;
  confidence: JobDiscoveryConfidence;
};

export type ScanCareerPageInput = {
  companyName: string;
  careerPageUrl: string;
};

export type ScanCareerPageResult = {
  companyName: string;
  careerPageUrl: string;
  sourceType: JobDiscoverySourceType;
  jobsScanned: number;
  possibleMatches: ScanPreviewJob[];
  message?: string;
};

export type ParsedJobCard = {
  title: string;
  jobUrl: string;
  location: string | null;
  jobId?: string | null;
};

export type ParsedJobDetail = {
  title: string;
  location: string | null;
  description: string;
  applyUrl?: string | null;
  jobId?: string | null;
};

export type RejectResult = {
  rejected: boolean;
  reason?: string;
};
