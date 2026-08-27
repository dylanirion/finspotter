import { relations } from "drizzle-orm"

import { adoptionsTable } from "../adoption/sql"
import {
  annotationMetaTable,
  annotationsIncrementerTable,
  annotationsTable,
} from "../annotation/sql"
import { accountsTable } from "../auth/account/sql"
import {
  invitationsTable,
  membersTable,
  organizationsTable,
} from "../auth/organization/sql"
import { sessionsTable } from "../auth/session/sql"
import { usersTable } from "../auth/user/sql"
import { verificationTokensTable } from "../auth/verificationToken/sql"
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
import { submissionsTable } from "../submission/sql"
import { subscribersTable } from "../subscriber/sql"
import { tagsTable } from "../tag/sql"

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

export const annotationsRelations = relations(
  annotationsTable,
  ({ one, many }) => ({
    media: one(mediaTable, {
      fields: [annotationsTable.mediaId],
      references: [mediaTable.id],
    }),
    individual: one(individualsTable, {
      fields: [annotationsTable.individualId],
      references: [individualsTable.id],
    }),
    detection: one(detectionsTable, {
      fields: [
        annotationsTable.mediaId,
        annotationsTable.detectionId,
        annotationsTable.updatedAt,
      ],
      references: [
        detectionsTable.mediaId,
        detectionsTable.detectionId,
        detectionsTable.createdAt,
      ],
    }),
    meta: many(annotationMetaTable),
  })
)

export const individualsRelations = relations(individualsTable, ({ many }) => ({
  annotations: many(annotationsTable),
  names: many(namesTable),
}))

export const mediaRelations = relations(mediaTable, ({ one, many }) => ({
  /*
  location: one(locationsTable, {
    fields: [mediaTable.id],
    references: [locationsTable.mediaId],
  }),
  */
  annotations: many(annotationsTable),
  exif: many(exifTable),
  meta: many(mediaMetaTable),
  submission: one(submissionsTable, {
    fields: [mediaTable.id],
    references: [submissionsTable.mediaId],
  }),
}))

export const namesRelations = relations(namesTable, ({ one }) => ({
  individual: one(individualsTable, {
    fields: [namesTable.individualId],
    references: [individualsTable.id],
  }),
  organization: one(organizationsTable, {
    fields: [namesTable.organizationId],
    references: [organizationsTable.id],
  }),
}))

export const organizationsRelations = relations(
  organizationsTable,
  ({ many }) => ({
    users: many(membersTable),
  })
)

export const usersRelations = relations(usersTable, ({ many }) => ({
  organizations: many(membersTable),
  submissions: many(submissionsTable),
  subscriptions: many(subscribersTable),
}))

export const usersToOrganizationsRelations = relations(
  membersTable,
  ({ one }) => ({
    organizations: one(organizationsTable, {
      fields: [membersTable.organizationId],
      references: [organizationsTable.id],
    }),
    users: one(usersTable, {
      fields: [membersTable.userId],
      references: [usersTable.id],
    }),
  })
)

export const invitationsRelations = relations(invitationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [invitationsTable.email],
    references: [usersTable.email],
  }),
  inviter: one(membersTable, {
    fields: [invitationsTable.inviterId],
    references: [membersTable.userId],
  }),
  organization: one(organizationsTable, {
    fields: [invitationsTable.organizationId],
    references: [organizationsTable.id],
  }),
}))

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
  annotationsRelations,
  individualsRelations,
  mediaRelations,
  namesRelations,
  organizationsRelations,
  usersRelations,
  usersToOrganizationsRelations,
  invitationsRelations,
}
