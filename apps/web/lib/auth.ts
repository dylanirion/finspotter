import "server-only"

import { cache } from "react"
import { auth } from "@finspotter/core/auth"

export const getSession = cache(
  async (params: Parameters<typeof auth.api.getSession>[0]) => {
    return await auth.api.getSession(params)
  }
)

export const listOrganizations = cache(
  async (params: Parameters<typeof auth.api.listOrganizations>[0]) => {
    return await auth.api.listOrganizations(params)
  }
)

export const {
  sendVerificationEmail,
  verifyEmail,
  createUserOnly,
  issueSubmissionVerification,
  confirmSubmission,
} = auth.api
