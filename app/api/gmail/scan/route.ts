import { classifyGmailMessage } from "@/lib/gmailClassifier";
import {
  fetchMessageBodyText,
  fetchMessageMetadata,
  getValidAccessToken,
  listJobRelatedMessageIds,
  mapDetectedType,
  scanWindow,
} from "@/lib/gmail";
import { runLlmExtractionFallback, shouldUseLlmFallback } from "@/lib/gmailLlmExtraction";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { dateToChicagoStoredDate, toChicagoDateKey } from "@/lib/dates";

function needsBodyFallback(classified: ReturnType<typeof classifyGmailMessage>) {
  if (classified.confidence <= 0.2) return false;
  const missingCompany = !classified.company || classified.company === "Unknown Company";
  const missingRole = !classified.role && classified.type !== "task";
  return missingCompany || missingRole || classified.confidence < 0.85;
}

export async function POST() {
  const scanStartedAt = new Date();
  const { start: scanWindowStart, end: scanWindowEnd } = scanWindow();

  try {
    const { accessToken } = await getValidAccessToken(prisma);
    const ids = await listJobRelatedMessageIds(accessToken);

    let scannedMessages = 0;
    let createdReviewItems = 0;
    let skippedDuplicates = 0;

    for (const messageRef of ids) {
      scannedMessages += 1;

      const existingReview = await prisma.reviewItem.findFirst({
        where: { gmailMessageId: messageRef.id },
        select: { id: true },
      });
      const existingMetadata = await prisma.emailMetadata.findUnique({
        where: { gmailMessageId: messageRef.id },
        select: { id: true },
      });

      if (existingReview || existingMetadata) {
        skippedDuplicates += 1;
        continue;
      }

      const metadata = await fetchMessageMetadata(accessToken, messageRef.id);
      const receivedAtForReview = metadata.receivedAt ? dateToChicagoStoredDate(metadata.receivedAt) : null;
      let bodyText = "";

      // Privacy rule: snippet/body text are only used in memory for classification and never persisted.
      let classified = classifyGmailMessage({
        sender: metadata.sender,
        subject: metadata.subject,
        snippet: metadata.snippet,
      });

      if (needsBodyFallback(classified)) {
        try {
          bodyText = await fetchMessageBodyText(accessToken, messageRef.id, 8000);
          if (bodyText) {
            classified = classifyGmailMessage({
              sender: metadata.sender,
              subject: metadata.subject,
              snippet: metadata.snippet,
              bodyText,
            });
          }
        } catch {
          // Keep the metadata/snippet classification if Gmail full-message fetch fails.
        }
      }

      const hybridExtraction =
        bodyText && shouldUseLlmFallback(classified)
          ? await runLlmExtractionFallback(classified, {
              sender: metadata.sender,
              subject: metadata.subject,
              bodyText,
            })
          : {
              result: classified,
              extractionMethod: classified.reason.startsWith("LinkedIn")
                ? "rule:linkedin_subject"
                : classified.reason.startsWith("Ashby")
                  ? "rule:ashby_subject"
                  : "rule",
              extractionReason: classified.reason,
            };

      classified = hybridExtraction.result;

      // Skip very low-confidence or non-actionable detections (e.g., digest/newsletter noise).
      if (classified.confidence <= 0.2) {
        skippedDuplicates += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const reviewItem = await tx.reviewItem.create({
          data: {
            type: classified.type,
            reviewStatus: ReviewStatus.pending,
            company: classified.company || "Unknown Company",
            role: classified.role,
            location: classified.location,
            suggestedStatus: classified.suggestedStatus,
            taskTitle: classified.taskTitle,
            source: "Gmail",
            gmailMessageId: metadata.gmailMessageId,
            threadId: metadata.threadId,
            emailSender: metadata.sender || null,
            emailSubject: metadata.subject || null,
            emailReceivedAt: receivedAtForReview,
            confidence: classified.confidence,
            extractedDataJson: JSON.stringify({
              reason: classified.reason,
              extractionMethod: hybridExtraction.extractionMethod,
              extractionReason: hybridExtraction.extractionReason,
              senderDomain: metadata.sender.split("@")[1] ?? null,
              location: classified.location,
              chicagoReceivedDate: metadata.receivedAt ? toChicagoDateKey(metadata.receivedAt) : null,
            }),
          },
        });

        await tx.$executeRaw`
          UPDATE "ReviewItem"
          SET
            "extractionMethod" = ${hybridExtraction.extractionMethod},
            "extractionReason" = ${hybridExtraction.extractionReason}
          WHERE "id" = ${reviewItem.id}
        `;

        await tx.emailMetadata.create({
          data: {
            gmailMessageId: metadata.gmailMessageId,
            threadId: metadata.threadId,
            sender: metadata.sender || null,
            subject: metadata.subject || null,
            receivedAt: metadata.receivedAt,
            detectedType: mapDetectedType(classified.type),
            confidence: classified.confidence,
          },
        });
      });

      createdReviewItems += 1;
    }

    const scanEndedAt = new Date();

    await prisma.scanHistory.create({
      data: {
        scanStartedAt,
        scanEndedAt,
        scanWindowStart,
        scanWindowEnd,
        resultCount: scannedMessages,
        createdReviewItemsCount: createdReviewItems,
      },
    });

    return NextResponse.json({
      scannedMessages,
      createdReviewItems,
      skippedDuplicates,
      scanWindowStart: scanWindowStart.toISOString(),
      scanWindowEnd: scanWindowEnd.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "GMAIL_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Gmail is not connected. Connect Gmail in Settings first." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail scan failed" },
      { status: 500 },
    );
  }
}
