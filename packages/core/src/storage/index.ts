import "server-only"

import { type Readable } from "stream"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"

import { getClient } from "../client"
import { type Condition } from "../database"

interface ObjectMetadata {
  size?: number
  contentType?: string
  lastModified?: Date
  [key: string]: unknown
}

interface PresignedUrlResult {
  bucket: string
  key: string
  url: string
  fields: Record<string, string>
}

const s3 = getClient(S3Client, {
  logger: {
    ...console,
    debug(..._args: unknown[]) {},
    trace(..._args: unknown[]) {},
  },
  requestHandler: {
    requestTimeout: 3_000,
    httpsAgent: { maxSockets: 25 },
  },
})

//TODO: getClient for DDBDoc?
const ddb = DynamoDBDocumentClient.from(
  getClient(DynamoDBClient, {
    logger: {
      ...console,
      debug(..._args: unknown[]) {},
      trace(..._args: unknown[]) {},
    },
    requestHandler: {
      requestTimeout: 3_000,
      httpsAgent: { maxSockets: 25 },
    },
  })
)

//TODO: reuse connections?
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-reusing-connections.html

interface StorageRepository {
  getItem: <T>(table: string, key: Record<string, string>) => Promise<T>
  putItem: (
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Record<string, any>>
  putItems: (
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: Record<string, any>[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Record<string, any>>
  queryItems: <T>(
    table: string,
    where: Condition,
    limit?: number,
    index?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursor?: Record<string, any>,
    keyFields?: string[],
    asc?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<{ items: T[]; cursor?: Record<string, any> }>
  getObject: (
    bucket: string,
    key: string
  ) => Promise<{
    body: ReadableStream | Readable | Blob
    metadata: ObjectMetadata
  }>
  getHead: (bucket: string, key: string) => Promise<ObjectMetadata>
  putObject: (
    bucket: string,
    key: string,
    body:
      | string
      | Readable
      | ReadableStream<unknown>
      | Blob
      | Uint8Array
      | Buffer,
    contentType?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Record<string, any>>
  copyObject: (
    source: string,
    bucket: string,
    key: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<Record<string, any>>
  getPresignedPostUrl: ({
    bucket,
    prefix,
    key,
    expiry,
    contentType,
    contentLength,
  }: {
    bucket: string
    prefix: string
    key: string
    expiry: number
    contentType: string
    contentLength: number
  }) => Promise<PresignedUrlResult>
}

// NB: arrow function to maintain "this" context
class AwsStorageRepository implements StorageRepository {
  private s3Client: S3Client
  private docClient: DynamoDBDocumentClient

  constructor(s3Client: S3Client, docClient: DynamoDBDocumentClient) {
    this.s3Client = s3Client
    this.docClient = docClient
  }

  getItem = async <T>(table: string, key: Record<string, string>) => {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: table,
        Key: key,
      })
    )

    if (!response.Item) throw new Error("Dynamo item returned no results.", key)

    return response.Item as T
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  putItem = async (table: string, item: Record<string, any>) => {
    return this.docClient.send(
      new PutCommand({
        TableName: table,
        Item: item,
      })
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  putItems = async (table: string, items: Record<string, any>[]) => {
    const itemChunks = chunkArray(items, 25)

    return Promise.all(
      itemChunks.map((chunk) => {
        const putRequests = chunk.map((item) => ({
          PutRequest: {
            Item: item,
          },
        }))

        return this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [table]: putRequests,
            },
          })
        )
      })
    )
  }

  queryItems = async <T>(
    table: string,
    where: Condition,
    limit?: number,
    index?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursor?: Record<string, any>,
    keyFields = ["pk", "sk"],
    asc = true
  ) => {
    const ExpressionAttributeNames: Record<string, string> = {}
    const ExpressionAttributeValues: Record<string, unknown> = {}

    const keyConditions: string[] = []
    const filterConditions: string[] = []

    const opMap: Record<string, string> = {
      eq: "=",
      ne: "<>",
      lt: "<",
      lte: "<=",
      gt: ">",
      gte: ">=",
    }

    for (const [field, rawCondition] of Object.entries(where)) {
      const attrName = `#${field}`
      ExpressionAttributeNames[attrName] = field

      const isKey = keyFields.includes(field)
      const pushTo = isKey ? keyConditions : filterConditions

      const condition =
        typeof rawCondition === "object" && "operator" in rawCondition
          ? rawCondition
          : { operator: "eq", value: rawCondition }

      const op = condition.operator

      if (isKey && !["eq", "starts_with", "between"].includes(op)) {
        throw new Error(`Operator ${op} not allowed on key field ${field}`)
      }

      if (op === "starts_with") {
        const attrValue = `:${field}_prefix`
        ExpressionAttributeValues[attrValue] = condition.value
        pushTo.push(`begins_with(${attrName}, ${attrValue})`)
      } else if (op === "between") {
        const [lo, hi] = condition.value as [number, number]
        const attrLo = `:${field}_lo`
        const attrHi = `:${field}_hi`
        ExpressionAttributeValues[attrLo] = lo
        ExpressionAttributeValues[attrHi] = hi
        pushTo.push(`${attrName} BETWEEN ${attrLo} AND ${attrHi}`)
      } else if (op === "not_exists") {
        pushTo.push(`attribute_not_exists(${attrName})`)
      } else if (op === "exists") {
        pushTo.push(`attribute_exists(${attrName})`)
      } else if (op === "in") {
        const attrValues = (
          condition.value as string[] | number[] | Date[]
        ).map((val, i) => {
          const key = `:${field}_${i}`
          ExpressionAttributeValues[key] = val
          return key
        })
        pushTo.push(`${attrName} IN (${attrValues.join(", ")})`)
      } else if (op === "not_in") {
        const attrValues = (
          condition.value as string[] | number[] | Date[]
        ).map((val, i) => {
          const key = `:${field}_${i}`
          ExpressionAttributeValues[key] = val
          return key
        })
        pushTo.push(`NOT (${attrName} IN (${attrValues.join(", ")}))`)
      } else if (op === "like" || op === "ilike") {
        const attrValue = `:${field}_contains`
        ExpressionAttributeValues[attrValue] = condition.value
        pushTo.push(`contains(${attrName}, ${attrValue})`)
      } else if (op in opMap && "value" in condition) {
        const attrValue = `:${field}`
        ExpressionAttributeValues[attrValue] = condition.value
        pushTo.push(`${attrName} ${opMap[op]} ${attrValue}`)
      } else {
        throw new Error(`Unsupported operator: ${op}`)
      }
    }

    const items: T[] = []
    let ExclusiveStartKey = cursor
    let remaining = limit ?? Infinity
    let lastEvaluatedKey: typeof cursor | undefined

    do {
      const response = await this.docClient.send(
        new QueryCommand({
          TableName: table,
          IndexName: index,
          KeyConditionExpression: keyConditions.join(" AND "),
          ExpressionAttributeNames,
          ExpressionAttributeValues,
          ...(filterConditions.length && {
            FilterExpression: filterConditions.join(" AND "),
          }),
          ...(ExclusiveStartKey && { ExclusiveStartKey }),
          ...(limit !== undefined && { Limit: Math.min(remaining, 1000) }),
          ScanIndexForward: asc,
        })
      )

      const fetched = (response.Items as T[]) ?? []
      items.push(...fetched)

      remaining = (limit ?? Infinity) - items.length
      lastEvaluatedKey = response.LastEvaluatedKey
      ExclusiveStartKey = lastEvaluatedKey
    } while (remaining > 0 && lastEvaluatedKey)

    return { items, cursor: lastEvaluatedKey }
  }

  getObject = async (bucket: string, key: string) => {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )

    if (!response.Body)
      throw new Error(`S3 object ${key} returned with no body.`)

    return {
      body: response.Body,
      metadata: {
        contentType: response.ContentType,
        size: response.ContentLength,
        lastModified: response.LastModified,
        ...response.Metadata,
      },
    }
  }

  getHead = async (bucket: string, key: string) => {
    const response = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )

    return {
      contentType: response.ContentType,
      size: response.ContentLength,
      lastModified: response.LastModified,
      ...response.Metadata,
    }
  }

  putObject = async (
    bucket: string,
    key: string,
    body:
      | string
      | Readable
      | ReadableStream<unknown>
      | Blob
      | Uint8Array
      | Buffer,
    contentType?: string
  ) => {
    return this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ...(contentType && { ContentType: contentType }),
      })
    )
  }

  copyObject = async (source: string, bucket: string, key: string) => {
    return this.s3Client.send(
      new CopyObjectCommand({
        CopySource: source,
        Bucket: bucket,
        Key: key,
      })
    )
  }

  getPresignedPostUrl = async ({
    bucket,
    prefix,
    key,
    expiry = 3600,
    contentType = "",
    contentLength,
  }: {
    bucket: string
    prefix: string
    key: string
    expiry: number
    contentType: string
    contentLength: number
  }) => {
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: `${prefix}/${key}`,
      Conditions: [
        ["content-length-range", contentLength, contentLength],
        { "Content-Type": contentType },
      ],
      Fields: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
      },
      Expires: expiry,
    })
    return { bucket, key, url, fields }
  }
}

export function createStorageRepository(): StorageRepository {
  return new AwsStorageRepository(s3, ddb)
}

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/**
 *
 * @param {Array} arr
 * @param {number} stride
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* chunkArray(arr: Array<any>, stride: number = 1) {
  for (let i = 0; i < arr.length; i += stride) {
    yield arr.slice(i, Math.min(i + stride, arr.length))
  }
}
