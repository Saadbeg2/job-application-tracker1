import { classifyGmailMessage } from "@/lib/gmailClassifier";
import { getValidAccessToken, listJobRelatedMessageIds, fetchMessageMetadata, mapDetectedType, scanWindow } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";

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

      // Privacy rule: snippet is only used in memory for classification and never persisted.
      const classified = classifyGmailMessage({
        sender: metadata.sender,
        subject: metadata.subject,
        snippet: metadata.snippet,
      });

      // Skip very low-confidence or non-actionable detections (e.g., digest/newsletter noise).
      if (classified.confidence <= 0.2) {
        skippedDuplicates += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.reviewItem.create({
          data: {
            type: classified.type,
            reviewStatus: ReviewStatus.pending,
            company: classified.company || "Unknown Company",
            role: classified.role,
            suggestedStatus: classified.suggestedStatus,
            taskTitle: classified.taskTitle,
            source: "Gmail",
            gmailMessageId: metadata.gmailMessageId,
            threadId: metadata.threadId,
            emailSender: metadata.sender || null,
            emailSubject: metadata.subject || null,
            emailReceivedAt: metadata.receivedAt,
            confidence: classified.confidence,
            extractedDataJson: JSON.stringify({
              reason: classified.reason,
              senderDomain: metadata.sender.split("@")[1] ?? null,
            }),
          },
        });

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
