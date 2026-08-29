import { defineRelations } from "drizzle-orm"

import { accountsTable } from "../account/sql"
import { adoptionsTable } from "../adoption/sql"
import {
  annotationMetaTable,
  annotationsIncrementerTable,
  annotationsTable,
} from "../annotation/sql"
import {
  annotationTypeEnum,
  detectionSourceEnum,
  detectionsTable,
} from "../detection/sql"
import { exifTable } from "../exif/sql"
import { individualsTable } from "../individual/sql"
import { locationsTable } from "../location/sql"
import { mediaMetaTable, mediaTable } from "../media/sql"
import { namesTable, nameTypeEnum } from "../name/sql"
import {
  invitationsTable,
  membersTable,
  organizationsTable,
} from "../organization/sql"
import { sessionsTable } from "../session/sql"
import { submissionsTable } from "../submission/sql"
import { subscribersTable } from "../subscriber/sql"
import { tagsTable } from "../tag/sql"
import { usersTable } from "../user/sql"
import { verificationTokensTable } from "../verificationToken/sql"

export {
  accountsTable,
  adoptionsTable,
  annotationMetaTable,
  annotationsTable,
  annotationsIncrementerTable,
  detectionSourceEnum,
  annotationTypeEnum,
  detectionsTable,
  individualsTable,
  exifTable,
  mediaTable,
  mediaMetaTable,
  //locationsTable,
  nameTypeEnum,
  namesTable,
  organizationsTable,
  membersTable,
  invitationsTable,
  sessionsTable,
  submissionsTable,
  subscribersTable,
  tagsTable,
  usersTable,
  verificationTokensTable,
}

export const relations = defineRelations(
  {
    mediaTable,
    annotationsTable,
    individualsTable,
    detectionsTable,
    annotationMetaTable,
    namesTable,
    organizationsTable,
    exifTable,
    mediaMetaTable,
    submissionsTable,
    usersTable,
    membersTable,
    subscribersTable,
    invitationsTable,
    accountsTable,
    sessionsTable,
    tagsTable,
    adoptionsTable,
  },
  (r) => ({
    annotationsTable: {
      media: r.one.mediaTable({
        from: r.annotationsTable.mediaId,
        to: r.mediaTable.id,
      }),
      individual: r.one.individualsTable({
        from: r.annotationsTable.individualId,
        to: r.individualsTable.id,
      }),
      detection: r.one.detectionsTable({
        from: [
          r.annotationsTable.mediaId,
          r.annotationsTable.detectionId,
          r.annotationsTable.updatedAt,
        ],
        to: [
          r.detectionsTable.mediaId,
          r.detectionsTable.detectionId,
          r.detectionsTable.createdAt,
        ],
      }),
      meta: r.many.annotationMetaTable(),
    },
    annotationMetaTable: {
      annotation: r.one.annotationsTable({
        from: r.annotationMetaTable.annotationId,
        to: r.annotationsTable.id,
      }),
    },
    individualsTable: {
      annotations: r.many.annotationsTable(),
      names: r.many.namesTable(),
      tags: r.many.tagsTable(),
      adoptions: r.many.adoptionsTable(),
    },
    namesTable: {
      individual: r.one.individualsTable({
        from: r.namesTable.individualId,
        to: r.individualsTable.id,
      }),
      organization: r.one.organizationsTable({
        from: r.namesTable.organizationId,
        to: r.organizationsTable.id,
      }),
    },
    mediaTable: {
      /*
    location: r.one.locationsTable({
      from: r.mediaTable.id,
      to: r.locationsTable.mediaId
    }),
    */
      annotations: r.many.annotationsTable(),
      exif: r.many.exifTable(),
      meta: r.many.mediaMetaTable(),
      submission: r.one.submissionsTable({
        from: r.mediaTable.id,
        to: r.submissionsTable.mediaId,
      }),
    },
    exifTable: {
      media: r.one.mediaTable({
        from: r.exifTable.mediaId,
        to: r.mediaTable.id,
      }),
    },
    mediaMetaTable: {
      media: r.one.mediaTable({
        from: r.mediaMetaTable.mediaId,
        to: r.mediaTable.id,
      }),
    },
    organizationsTable: {
      members: r.many.membersTable(),
      invitations: r.many.invitationsTable(),
    },
    usersTable: {
      accounts: r.many.accountsTable(),
      sessions: r.many.sessionsTable(),
      members: r.many.membersTable(),
      invitations: r.many.invitationsTable(),
      submissions: r.many.submissionsTable(),
      subscriptions: r.many.subscribersTable(),
      adoptions: r.many.adoptionsTable(),
    },
    membersTable: {
      organization: r.one.organizationsTable({
        from: r.membersTable.organizationId,
        to: r.organizationsTable.id,
      }),
      user: r.one.usersTable({
        from: r.membersTable.userId,
        to: r.usersTable.id,
      }),
    },
    submissionsTable: {
      user: r.one.usersTable({
        from: r.submissionsTable.userId,
        to: r.usersTable.id,
      }),
      media: r.one.mediaTable({
        from: r.submissionsTable.mediaId,
        to: r.mediaTable.id,
      }),
      organization: r.one.organizationsTable({
        from: r.submissionsTable.organizationId,
        to: r.organizationsTable.id,
      }),
    },
    subscribersTable: {
      user: r.one.usersTable({
        from: r.subscribersTable.userId,
        to: r.usersTable.id,
      }),
      media: r.one.mediaTable({
        from: r.subscribersTable.mediaId,
        to: r.mediaTable.id,
      }),
    },
    invitationsTable: {
      user: r.one.usersTable({
        from: r.invitationsTable.email,
        to: r.usersTable.email,
      }),
      inviter: r.one.membersTable({
        from: r.invitationsTable.inviterId,
        to: r.membersTable.id,
      }),
      organization: r.one.organizationsTable({
        from: r.invitationsTable.organizationId,
        to: r.organizationsTable.id,
      }),
    },
    accountsTable: {
      user: r.one.usersTable({
        from: r.accountsTable.userId,
        to: r.usersTable.id,
      }),
    },
    sessionsTable: {
      user: r.one.usersTable({
        from: r.sessionsTable.userId,
        to: r.usersTable.id,
      }),
    },
    tagsTable: {
      individual: r.one.individualsTable({
        from: r.tagsTable.individualId,
        to: r.individualsTable.id,
      }),
    },
    adoptionsTable: {
      individual: r.one.individualsTable({
        from: r.adoptionsTable.individualId,
        to: r.individualsTable.id,
      }),
      user: r.one.usersTable({
        from: r.adoptionsTable.userId,
        to: r.usersTable.id,
      }),
    },
  })
)

export default {
  accountsTable,
  adoptionsTable,
  annotationsTable,
  annotationMetaTable,
  annotationsIncrementerTable,
  detectionSourceEnum,
  annotationTypeEnum,
  detectionsTable,
  individualsTable,
  exifTable,
  mediaTable,
  mediaMetaTable,
  //locationsTable,
  nameTypeEnum,
  namesTable,
  organizationsTable,
  sessionsTable,
  submissionsTable,
  subscribersTable,
  tagsTable,
  usersTable,
  membersTable,
  invitationsTable,
  verificationTokensTable,
  relations,
}
