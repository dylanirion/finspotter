import "server-only"

import { cache } from "react"
import { auth } from "@finspotter/core/auth"
import { createEmailVerificationToken as createToken } from "better-auth/api"

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

export async function createEmailVerificationToken(email: string) {
  const context = await auth.$context
  return createToken(
    context.secret,
    email,
    undefined,
    context.options.emailVerification?.expiresIn
  )
}

export const { sendVerificationEmail, verifyEmail, createUserOnly } = auth.api
