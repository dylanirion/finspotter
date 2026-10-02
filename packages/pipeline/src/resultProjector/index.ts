import type { AttributeValue } from "@aws-sdk/client-dynamodb"
import { unmarshall } from "@aws-sdk/util-dynamodb"
import { createPipelineResultRepository } from "@finspotter/core/pipelineResult"
import { z } from "zod"

const sourceReferenceSchema = z.object({
  pk: z.string(),
  sk: z.string(),
})

const pairResultSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  item_type: z.literal("pair_result"),
  review_status: z.literal("ready"),
  review_score: z.number(),
  review_ready_at: z.coerce.date(),
  created_at: z.coerce.date().optional(),
  expires: z.number().optional(),
  superseded_by: z.string().optional(),
  final: z.boolean().optional(),
  source_query: sourceReferenceSchema.optional(),
  source_ref: sourceReferenceSchema.optional(),
})

const autoReviewedExtractionSchema = z.object({
  pk: z.string(),
  sk: z.string().startsWith("extraction#"),
  media_id: z.string(),
  detection_id: z.string(),
  auto_review: z.literal(true),
  annotation_id: z.uuid(),
  reviewed_by: z.uuid(),
  reviewed_at: z.coerce.date(),
  created_at: z.coerce.date().optional(),
  expires: z.number().optional(),
  superseded_by: z.string().optional(),
  final: z.boolean().optional(),
  source_detection: sourceReferenceSchema.optional(),
})

const terminalResultSchema = z.object({
  pk: z.string(),
  sk: z.string().refine(
    (key) =>
      key.startsWith("media#") ||
      key.startsWith("detection#") ||
      key.startsWith("extraction#"),
    "Unsupported terminal pipeline result"
  ),
  media_id: z.string(),
  final: z.literal(true),
  review_status: z.literal("ready"),
  review_ready_at: z.coerce.date(),
  score: z.number().optional(),
  created_at: z.coerce.date().optional(),
  expires: z.number().optional(),
  superseded_by: z.string().optional(),
  source_media: sourceReferenceSchema.optional(),
  source_detection: sourceReferenceSchema.optional(),
})

type DynamoStreamEvent = {
  detail: {
    dynamodb: {
      NewImage?: Record<string, AttributeValue>
    }
  }
}

export async function handler(event: DynamoStreamEvent) {
  const image = event.detail.dynamodb.NewImage
  if (!image) throw new Error("Review-ready event has no DynamoDB NewImage")

  const payload = unmarshall(image)
  const pairResult = pairResultSchema.safeParse(payload)
  if (!pairResult.success) {
    const autoReviewedExtraction = autoReviewedExtractionSchema.safeParse(payload)
    if (!autoReviewedExtraction.success) {
      const terminal = terminalResultSchema.parse(payload)
      const kind = terminal.sk.startsWith("media#")
        ? "media"
        : terminal.sk.startsWith("detection#")
          ? "detection"
          : "extraction"
      const source = terminal.source_detection ?? terminal.source_media

      return createPipelineResultRepository().project({
        sourcePk: terminal.pk,
        sourceSk: terminal.sk,
        kind,
        submissionId: terminal.pk,
        mediaId: terminal.media_id,
        payload,
        sourceCreatedAt: terminal.created_at,
        expiresAt:
          terminal.expires === undefined
            ? undefined
            : new Date(terminal.expires * 1_000),
        supersededBy: terminal.superseded_by,
        final: true,
        reviewStatus: "ready",
        reviewScore: kind === "detection" ? terminal.score : undefined,
        reviewReadyAt: terminal.review_ready_at,
        links: source
          ? [
              {
                relation: "derived_from",
                relatedSourcePk: source.pk,
                relatedSourceSk: source.sk,
              },
            ]
          : undefined,
      })
    }

    const extraction = autoReviewedExtraction.data
    return createPipelineResultRepository().project({
      sourcePk: extraction.pk,
      sourceSk: extraction.sk,
      kind: "extraction",
      submissionId: extraction.pk,
      mediaId: extraction.media_id,
      payload,
      sourceCreatedAt: extraction.created_at,
      expiresAt:
        extraction.expires === undefined
          ? undefined
          : new Date(extraction.expires * 1_000),
      supersededBy: extraction.superseded_by,
      final: extraction.final,
      reviewStatus: "approved",
      reviewReadyAt: extraction.reviewed_at,
      reviewedBy: extraction.reviewed_by,
      reviewedAt: extraction.reviewed_at,
      annotationId: extraction.annotation_id,
      links: extraction.source_detection
        ? [
            {
              relation: "derived_from",
              relatedSourcePk: extraction.source_detection.pk,
              relatedSourceSk: extraction.source_detection.sk,
            },
          ]
        : undefined,
    })
  }

  const item = pairResult.data
  const links = [
    item.source_query && {
      relation: "query" as const,
      relatedSourcePk: item.source_query.pk,
      relatedSourceSk: item.source_query.sk,
    },
    item.source_ref && {
      relation: "reference" as const,
      relatedSourcePk: item.source_ref.pk,
      relatedSourceSk: item.source_ref.sk,
    },
  ].filter((link) => link !== undefined)

  return createPipelineResultRepository().project({
    sourcePk: item.pk,
    sourceSk: item.sk,
    kind: "pair",
    submissionId: item.pk,
    payload,
    sourceCreatedAt: item.created_at,
    expiresAt:
      item.expires === undefined ? undefined : new Date(item.expires * 1_000),
    supersededBy: item.superseded_by,
    final: item.final,
    reviewStatus: "ready",
    reviewScore: item.review_score,
    reviewReadyAt: item.review_ready_at,
    links,
  })
}