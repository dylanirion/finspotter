import {
  createPairJobKey,
  type ExtractionReference,
  type PairJobItem,
} from "@finspotter/core/pipeline/pairs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"

const configuredTable = process.env.TABLE
if (!configuredTable) throw new Error("TABLE is required")
const table: string = configuredTable

const algorithm = process.env.PAIRWISE_ALGORITHM ?? "faiss:pairwise:v1"
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}))

type StoredExtraction = {
  pk: string
  sk: string
  media_id: string
  detection_id: string
  gsi1pk?: string
  uri: {
    features: {
      bucket: string
      key: string
    }
  }
}

type PairJobEvent = ExtractionReference | { submissionId: string }

export async function handler(event: PairJobEvent) {
  if ("submissionId" in event) {
    const extractions = await findExtractions(event.submissionId)
    const jobs: PairJobItem[] = []
    for (let left = 0; left < extractions.length; left++) {
      for (let right = left + 1; right < extractions.length; right++) {
        if (extractions[left].media_id === extractions[right].media_id) continue
        jobs.push(
          createPairJob(extractions[left], extractions[right], algorithm)
        )
      }
    }
    const created = await Promise.all(jobs.map(createPairJobIfMissing))
    return {
      total: jobs.length,
      created: created
        .filter((job): job is PairJobItem => job !== undefined)
        .map(({ pk, sk }) => ({ pk, sk })),
    }
  }

  const extraction = event
  if (
    !extraction.pk ||
    !extraction.sk ||
    !extraction.media_id ||
    !extraction.detection_id ||
    !extraction.bucket ||
    !extraction.key
  ) {
    throw new Error("Extraction event is incomplete")
  }

  const candidates = await findExtractions(extraction.pk)
  const jobs = candidates
    .filter(
      (candidate) =>
        candidate.sk !== extraction.sk &&
        candidate.media_id !== extraction.media_id
    )
    .map((candidate) => createPairJob(extraction, candidate, algorithm))
  const created = await Promise.all(jobs.map(createPairJobIfMissing))

  return {
    total: jobs.length,
    created: created
      .filter((job): job is PairJobItem => job !== undefined)
      .map(({ pk, sk }) => ({ pk, sk })),
  }
}

async function findExtractions(submissionId: string) {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "#PK = :pk AND begins_with(#SK, :extraction)",
      ExpressionAttributeNames: {
        "#PK": "pk",
        "#SK": "sk",
      },
      ExpressionAttributeValues: {
        ":pk": submissionId,
        ":extraction": "extraction#",
      },
      ConsistentRead: true,
    })
  )
  const extractions = ((response.Items as StoredExtraction[] | undefined) ?? []).map(
    (candidate) => ({
      pk: candidate.pk,
      sk: candidate.sk,
      media_id: candidate.media_id,
      detection_id: candidate.detection_id,
      bucket: candidate.uri.features.bucket,
      key: candidate.uri.features.key,
    })
  )
  const mediaIds = [...new Set(extractions.map(({ media_id }) => media_id))]
  if (!mediaIds.length) return []

  // TODO: chunk BatchGet requests when a submission can exceed 100 media items.
  const mediaResponse = await dynamo.send(
    new BatchGetCommand({
      RequestItems: {
        [table]: {
          Keys: mediaIds.map((mediaId) => ({
            pk: submissionId,
            sk: `media#${mediaId}`,
          })),
          ProjectionExpression: "media_id, accepted, upload_status",
        },
      },
    })
  )
  const accepted = new Set(
    (
      (mediaResponse.Responses?.[table] ?? []) as Array<{
        media_id: string
        accepted?: boolean
        upload_status?: string
      }>
    )
      .filter(
        (media) => media.accepted === true && media.upload_status !== "removed"
      )
      .map((media) => media.media_id as string)
  )

  return extractions.filter(({ media_id }) => accepted.has(media_id))
}

export function createPairJob(
  extraction: ExtractionReference,
  candidate: ExtractionReference,
  pairwiseAlgorithm: string,
  now = new Date().toISOString()
): PairJobItem {
  const [left, right] = [extraction, candidate].sort((a, b) =>
    a.sk.localeCompare(b.sk)
  )
  return {
    pk: extraction.pk,
    sk: createPairJobKey(left, right, pairwiseAlgorithm),
    item_type: "pair_job",
    state: "pending",
    algorithm: pairwiseAlgorithm,
    left,
    right,
    created_at: now,
    updated_at: now,
    attempts: 0,
  }
}

async function createPairJobIfMissing(job: PairJobItem) {
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk: job.pk, sk: job.sk },
        ConditionExpression: "attribute_not_exists(#PK)",
        ExpressionAttributeNames: {
          "#PK": "pk",
          "#ITEMTYPE": "item_type",
          "#STATE": "state",
          "#ALGORITHM": "algorithm",
          "#LEFT": "left",
          "#RIGHT": "right",
          "#CREATEDAT": "created_at",
          "#UPDATEDAT": "updated_at",
          "#ATTEMPTS": "attempts",
        },
        ExpressionAttributeValues: {
          ":itemType": job.item_type,
          ":state": job.state,
          ":algorithm": job.algorithm,
          ":left": job.left,
          ":right": job.right,
          ":createdAt": job.created_at,
          ":updatedAt": job.updated_at,
          ":attempts": job.attempts,
        },
        UpdateExpression:
          "SET #ITEMTYPE = :itemType, #STATE = :state, #ALGORITHM = :algorithm, #LEFT = :left, #RIGHT = :right, #CREATEDAT = :createdAt, #UPDATEDAT = :updatedAt, #ATTEMPTS = :attempts",
      })
    )
    return job
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    )
      return undefined
    throw error
  }
}
