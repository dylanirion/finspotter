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

type Transaction = {
  execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }>
}
type Database = Transaction & {
  transaction: <Result>(
    callback: (transaction: Transaction) => Promise<Result>
  ) => Promise<Result>
}
const normalizeClaim = (input: SubmissionClaim) =>
  claimSchema.parse({
    ...input,
    email: input.email.trim().toLowerCase(),
    mediaIds: [...new Set(input.mediaIds)].sort(),
  })
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
  async function associate(
    transaction: Transaction,
    claim: SubmissionClaim,
    submittedFrom?: string,
    verified = false
  ) {
    const table = tableForRole(claim.role)
    const submitter = claim.role === "submitter"
    const conflict = submitter ? sql`(media_id)` : sql`(media_id, user_id)`
    const eligible = submitter
      ? sql`true`
      : sql`EXISTS (
        SELECT 1 FROM submissions WHERE media_id = media.id AND submission_id = ${claim.submissionId}
      )`
    const address = z
      .union([z.ipv4(), z.ipv6()])
      .optional()
      .parse(submittedFrom)
    const { rows } = await transaction.execute(sql`
      INSERT INTO ${table} (media_id, submission_id, user_id, verified_at${submitter ? sql`, submitted_from` : sql``})
      SELECT id, ${claim.submissionId}, ${claim.userId}::uuid, ${verified ? sql`now()` : sql`NULL::timestamp`}${submitter ? sql`, ${address ?? null}::inet` : sql``}
      FROM media WHERE id = ANY(${mediaArray(claim.mediaIds)}) AND ${eligible}
      ON CONFLICT ${conflict} DO UPDATE SET
        submission_id = EXCLUDED.submission_id,
        verified_at = COALESCE(${table}.verified_at, EXCLUDED.verified_at)
        ${submitter ? sql`, submitted_from = COALESCE(${table}.submitted_from, EXCLUDED.submitted_from)` : sql``}
      WHERE ${table}.submission_id = EXCLUDED.submission_id AND ${table}.user_id = EXCLUDED.user_id
      RETURNING media_id
    `)
    if (rows.length !== claim.mediaIds.length)
      throw new Error("Invalid submission media")
  }

  return {
    async issue(input: SubmissionClaim, submittedFrom?: string) {
      const claim = normalizeClaim(input)
      const token = randomBytes(32).toString("hex")
      await database.transaction(async (transaction) => {
        const user = await transaction.execute(sql`
          SELECT id FROM "user"
          WHERE id = ${claim.userId}::uuid AND lower(email) = ${claim.email}
          FOR UPDATE
        `)
        if (user.rows.length !== 1)
          throw new Error("Verification link is no longer valid")
        await associate(transaction, claim, submittedFrom)
        const { rows } = await transaction.execute(sql`
          INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
          VALUES (${randomUUID()}::uuid, ${identifier(token)}, ${JSON.stringify(claim)},
            now() + interval '24 hours', now(), now())
          RETURNING id
        `)
        if (rows.length !== 1)
          throw new Error("Unable to issue verification token")
      })
      return token
    },

    async submitAuthenticated(input: SubmissionClaim, submittedFrom?: string) {
      const claim = normalizeClaim(input)
      if (claim.role !== "submitter")
        throw new Error("Only the authenticated submitter can be auto-verified")
      await database.transaction(async (transaction) => {
        const { rows } = await transaction.execute(sql`
          SELECT id FROM "user"
          WHERE id = ${claim.userId}::uuid AND lower(email) = ${claim.email}
            AND email_verified = true
          FOR UPDATE
        `)
        if (rows.length !== 1) throw new Error("Verified user required")
        await associate(transaction, claim, submittedFrom, true)
      })
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
      await database.transaction(async (transaction) => {
        const consumed = await transaction.execute(sql`
          DELETE FROM verification
          WHERE identifier = ${identifier(token)} AND expires_at > now() AND value = ${JSON.stringify(claim)}
          RETURNING id
        `)
        if (consumed.rows.length !== 1)
          throw new Error("Invalid, expired, or already used verification link")
        const user = await transaction.execute(sql`
          SELECT email_verified FROM "user"
          WHERE id = ${claim.userId}::uuid AND lower(email) = ${claim.email}
          FOR UPDATE
        `)
        if (user.rows.length !== 1)
          throw new Error("Verification link is no longer valid")
        const associated = await transaction.execute(sql`
          SELECT media_id FROM ${table}
          WHERE submission_id = ${claim.submissionId} AND user_id = ${claim.userId}::uuid
          FOR UPDATE
        `)
        if (
          associated.rows.length !== claim.mediaIds.length ||
          associated.rows.some(
            (row) => !claim.mediaIds.includes(String(row.media_id))
          )
        )
          throw new Error("Invalid submission media")
        const verified = await transaction.execute(sql`
          UPDATE ${table} SET verified_at = COALESCE(verified_at, now())
          WHERE submission_id = ${claim.submissionId} AND user_id = ${claim.userId}::uuid
            AND media_id = ANY(${mediaArray(claim.mediaIds)})
          RETURNING media_id
        `)
        if (verified.rows.length !== claim.mediaIds.length)
          throw new Error("Invalid submission confirmation")
        if (!user.rows[0].email_verified) {
          await transaction.execute(
            sql`DELETE FROM account WHERE user_id = ${claim.userId}::uuid`
          )
          await transaction.execute(
            sql`DELETE FROM session WHERE user_id = ${claim.userId}::uuid`
          )
        }
        const verifiedUser = await transaction.execute(sql`
          UPDATE "user" SET email_verified = true, updated_at = now()
          WHERE id = ${claim.userId}::uuid AND lower(email) = ${claim.email}
          RETURNING id
        `)
        if (verifiedUser.rows.length !== 1)
          throw new Error("Invalid submission confirmation")
      })
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
