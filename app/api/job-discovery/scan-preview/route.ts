import { scanCareerPage } from "@/lib/jobDiscovery/scanCareerPage";
import { NextResponse } from "next/server";

type ScanPreviewBody = {
  companyName?: string;
  careerPageUrl?: string;
};

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as ScanPreviewBody;
  const companyName = String(body.companyName ?? "").trim();
  const careerPageUrl = String(body.careerPageUrl ?? "").trim();

  if (!companyName || !careerPageUrl) {
    return NextResponse.json({ error: "companyName and careerPageUrl are required" }, { status: 400 });
  }

  if (!isValidHttpUrl(careerPageUrl)) {
    return NextResponse.json({ error: "careerPageUrl must be a valid HTTP or HTTPS URL" }, { status: 400 });
  }

  try {
    const result = await scanCareerPage({ companyName, careerPageUrl });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Scan preview failed";
    console.error("[job-discovery] scan preview failed", { companyName, careerPageUrl, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
