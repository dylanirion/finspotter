import { createHash, randomBytes, randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { z } from "zod"

const claimSchema = z.object({
  submissionId: z.string().min(1),
  userId: z.uuid(),
  email: z.email(),
  role: z.enum(["submitter", "subscriber"]),
  mediaIds: z.array(z.uuid()).min(1),
})

export type SubmissionClaim = z.infer<typeof claimSchema>
export type SubmissionContact = SubmissionClaim & {
  verified_at: string
  updates_enabled: boolean
}

type Database = {
  execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }>
}
const identifier = (token: string) =>
  `submission-verification:${createHash("sha256").update(token).digest("hex")}`
const mediaArray = (ids: string[]) =>
  sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  )}]::uuid[]`
const tableForRole = (role: SubmissionClaim["role"]) =>
  role === "submitter" ? sql`submissions` : sql`subscribers`

export function createSubmissionVerificationRepository({
  database,
}: {
  database: Database
}) {
  return {
    async issue(input: SubmissionClaim) {
      const claim = claimSchema.parse({
        ...input,
        email: input.email.trim().toLowerCase(),
        mediaIds: [...new Set(input.mediaIds)].sort(),
      })
      const token = randomBytes(32).toString("hex")
      const table = tableForRole(claim.role)
      const conflict =
        claim.role === "submitter" ? sql`(media_id)` : sql`(media_id, user_id)`
      const eligible =
        claim.role === "submitter"
          ? sql`true`
          : sql`EXISTS (
        SELECT 1 FROM submissions WHERE media_id = media.id AND submission_id = ${claim.submissionId}
      )`
      const result = await database.execute(sql`
        WITH associated AS (
          INSERT INTO ${table} (media_id, submission_id, user_id)
          SELECT id, ${claim.submissionId}, ${claim.userId}::uuid FROM media
          WHERE id = ANY(${mediaArray(claim.mediaIds)}) AND ${eligible}
          ON CONFLICT ${conflict} DO UPDATE SET submission_id = EXCLUDED.submission_id
          WHERE ${table}.submission_id = EXCLUDED.submission_id AND ${table}.user_id = EXCLUDED.user_id
          RETURNING media_id
        )
        INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
        SELECT (CASE WHEN (SELECT count(*) FROM associated) = ${claim.mediaIds.length}
          THEN ${randomUUID()} ELSE 'invalid-submission-media' END)::uuid,
          ${identifier(token)}, ${JSON.stringify(claim)}, now() + interval '24 hours', now(), now()
        RETURNING id
      `)
      if (!result.rows.length)
        throw new Error("Unable to issue verification token")
      return token
    },

    async inspect(submissionId: string, token: string) {
      if (!/^[a-f0-9]{64}$/.test(token))
        throw new Error("Invalid verification link")
      const { rows } = await database.execute(sql`
        SELECT value FROM verification WHERE identifier = ${identifier(token)} AND expires_at > now()
      `)
      if (rows.length !== 1)
        throw new Error("Invalid, expired, or already used verification link")
      const claim = claimSchema.parse(JSON.parse(String(rows[0].value)))
      if (claim.submissionId !== submissionId)
        throw new Error("Verification link does not match submission")
      return claim
    },

    async confirm(claim: SubmissionClaim, token: string) {
      const table = tableForRole(claim.role)
      const result = await database.execute(sql`
        WITH consumed AS (
          DELETE FROM verification
          WHERE identifier = ${identifier(token)} AND expires_at > now() AND value = ${JSON.stringify(claim)}
            AND EXISTS (SELECT 1 FROM "user" WHERE id = ${claim.userId}::uuid AND lower(email) = ${claim.email})
            AND (SELECT count(*) FROM ${table} WHERE submission_id = ${claim.submissionId} AND user_id = ${claim.userId}::uuid) = ${claim.mediaIds.length}
            AND (SELECT count(*) FROM ${table} WHERE submission_id = ${claim.submissionId} AND user_id = ${claim.userId}::uuid AND media_id = ANY(${mediaArray(claim.mediaIds)})) = ${claim.mediaIds.length}
          RETURNING id
        ), verified_media AS (
          UPDATE ${table} SET verified_at = COALESCE(verified_at, now())
          WHERE submission_id = ${claim.submissionId} AND user_id = ${claim.userId}::uuid
            AND media_id = ANY(${mediaArray(claim.mediaIds)}) AND EXISTS (SELECT 1 FROM consumed)
          RETURNING media_id
        ), revoked_accounts AS (
          DELETE FROM account WHERE user_id = ${claim.userId}::uuid
            AND EXISTS (SELECT 1 FROM consumed)
            AND EXISTS (SELECT 1 FROM "user" WHERE id = ${claim.userId}::uuid AND NOT COALESCE(email_verified, false))
          RETURNING id
        ), revoked_sessions AS (
          DELETE FROM session WHERE user_id = ${claim.userId}::uuid
            AND EXISTS (SELECT 1 FROM consumed)
            AND EXISTS (SELECT 1 FROM "user" WHERE id = ${claim.userId}::uuid AND NOT COALESCE(email_verified, false))
          RETURNING id
        ), verified_user AS (
          UPDATE "user" SET email_verified = true, updated_at = now()
          WHERE id = ${claim.userId}::uuid AND lower(email) = ${claim.email} AND EXISTS (SELECT 1 FROM consumed)
          RETURNING id
        )
        SELECT (CASE WHEN (SELECT count(*) FROM verified_media) = ${claim.mediaIds.length}
          AND (SELECT count(*) FROM verified_user) = 1
          THEN id::text ELSE 'invalid-submission-confirmation' END)::uuid AS id FROM consumed
      `)
      if (result.rows.length !== 1)
        throw new Error("Invalid, expired, or already used verification link")
    },

    async listContacts(submissionId: string, userId: string) {
      const contacts: SubmissionContact[] = []
      for (const role of ["submitter", "subscriber"] as const) {
        const { rows } = await database.execute(sql`
          SELECT array_agg(media_id ORDER BY media_id) AS media_ids,
            min(verified_at) AS verified_at, bool_and(updates_enabled) AS updates_enabled,
            (SELECT email FROM "user" WHERE id = ${userId}::uuid) AS email
          FROM ${tableForRole(role)} WHERE submission_id = ${submissionId} AND user_id = ${userId}::uuid
          HAVING count(*) > 0 AND bool_and(verified_at IS NOT NULL)
        `)
        for (const row of rows)
          contacts.push({
            submissionId,
            userId,
            role,
            email: String(row.email),
            mediaIds: row.media_ids as string[],
            verified_at: String(row.verified_at),
            updates_enabled: Boolean(row.updates_enabled),
          })
      }
      return contacts
    },

    async setUpdates(contact: SubmissionContact, enabled: boolean) {
      await database.execute(sql`
        UPDATE ${tableForRole(contact.role)} SET updates_enabled = ${enabled}
        WHERE submission_id = ${contact.submissionId} AND user_id = ${contact.userId}::uuid
          AND verified_at IS NOT NULL AND media_id = ANY(${mediaArray(contact.mediaIds)})
      `)
    },
  }
}
