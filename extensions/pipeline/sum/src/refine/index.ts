import { parse } from "path"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb"

type Payload = {
  pk: string
  sk: string
  bucket: string
  key: string
}

type Event = {
  submissionId: string
  index: number
  payload: Payload
  config: null
  expires: string
}

type MatchSet = {
  from: number
  to: number
  distance: number
  score: number
}[]

const s3 = new S3Client({
  logger: {
    ...console,
    debug(..._args) {},
    trace(..._args) {},
  },
  requestHandler: {
    requestTimeout: 3_000,
    httpsAgent: { maxSockets: 25 },
  },
})

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    logger: {
      ...console,
      debug(..._args) {},
      trace(..._args) {},
    },
    requestHandler: {
      requestTimeout: 3_000,
      httpsAgent: { maxSockets: 25 },
    },
  })
)

export async function handler(event: Event) {
  const {
    pk,
    sk: prevSk,
    bucket: matchsetBucket,
    key: matchsetKey,
  } = event.payload
  const { index, expires } = event
  const matchset_path = parse(matchsetKey)

  //TODO: Validate Content-Type from S3?
  console.log(`Downloading matches from ${matchsetBucket}/${matchsetKey}`)
  const matches = await getObject(matchsetBucket, matchsetKey)
  const score = matches.reduce((agg, cur) => (agg += cur.score), 0)

  // put results on dynamo
  const [aEncoded, bEncoded] = matchset_path.name.split("-")
  const [aMediaId, aDetectionId] = decodeId(aEncoded)
  const [bMediaId, bDetectionId] = decodeId(bEncoded)
  const [_, type, ...rest] = prevSk.split("#")
  const sk = `search#${type}#${aMediaId}#${aDetectionId}#${bMediaId}#${bDetectionId}#${index}#score`
  console.log(`Storing refinement result in dynamo:${pk}/${sk}`)
  const updateExpr = [
    "#QUERY = :query",
    "#REF = :ref",
    "#INDEX = :index",
    "#TYPE = :type",
    "#URI = :uri",
    "#SCORE = :score",
    "#CREATEDAT = :createdat",
    "#GSI1PK = :gsi1pk",
  ]
  if (expires) updateExpr.push("#EXPIRES = :expires")
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: process.env["TABLE"],
            Key: {
              pk,
              sk: prevSk,
            },
            ExpressionAttributeNames: {
              "#GSI1PK": "gsi1pk",
              "#SUPERSEDEDBY": "superseded_by",
            },
            ExpressionAttributeValues: {
              ":supersededby": sk,
            },
            UpdateExpression:
              "REMOVE #GSI1PK SET #SUPERSEDEDBY = :supersededby",
          },
        },
        {
          Update: {
            TableName: process.env["TABLE"],
            Key: {
              pk,
              sk,
            },
            ExpressionAttributeNames: {
              "#QUERY": "query",
              "#REF": "ref",
              "#INDEX": "index",
              "#TYPE": "type",
              "#URI": "uri",
              "#SCORE": "score",
              "#CREATEDAT": "created_at",
              "#GSI1PK": "gsi1pk",
              ...(expires && { "#EXPIRES": "expires" }),
            },
            ExpressionAttributeValues: {
              ":query": {
                media_id: aMediaId,
                detection_id: aDetectionId,
              },
              ":ref": {
                media_id: bMediaId,

                detection_id: bDetectionId,
              },
              ":type": "score",
              ":index": Number(index + 1),
              ":uri": {
                bucket: matchsetBucket,
                key: matchsetKey,
              },
              ":score": score,
              ":createdat": new Date().toISOString(),
              ":gsi1pk": "result",
              ...(expires && { ":expires": expires }),
            },
            UpdateExpression: "SET " + updateExpr.join(", "),
          },
        },
      ],
    })
  )

  return { pk, sk, bucket: matchsetBucket, key: matchsetKey }
}

async function getObject(bucket: string, key: string) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )

  if (!response.Body) throw new Error(`S3 object ${key} returned with no body.`)

  return JSON.parse(await response.Body.transformToString()) as MatchSet
}

function decodeId(encoded: string) {
  const padLength = (4 - (encoded.length % 4)) % 4
  const padded = encoded + "=".repeat(padLength)

  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  const decoded = Buffer.from(base64, "base64").toString("utf-8")

  return decoded.split("|")
}
