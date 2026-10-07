import { type BetterAuthPlugin, type User } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { parseUserInput } from "better-auth/db"
import { z } from "zod"

import { db } from "../database/_drizzle"
import { createSubmissionVerificationRepository } from "./submissionClaims"

export const submissionVerification = () =>
  createSubmissionVerificationRepository({
    database: db,
  })

const nodeENV: string =
  (typeof process !== "undefined" && process.env && process.env.NODE_ENV) || ""
const isDevelopment = nodeENV === "dev" || nodeENV === "development"

export const authPlugin = () => {
  return {
    id: "auth-plugin",
    onRequest: async (request, ctx) => {
      try {
        if (
          !["/sign-up/email", "/sign-in/email", "/request-password-reset"].some(
            (endpoint) => request.url.includes(endpoint)
          )
        )
          return undefined
        const captchaToken = request.headers.get("x-captcha-token")

        if (!captchaToken) {
          return {
            response: new Response(
              JSON.stringify({
                message: "reCAPTCHA token required",
              }),
              {
                status: 400,
              }
            ),
          }
        }

        const { validateReCaptcha } = await import("../recaptcha")
        return await validateReCaptcha(captchaToken)
      } catch (_error) {
        const errorMessage =
          _error instanceof Error ? _error.message : undefined

        ctx.logger.error(errorMessage ?? "Unknown error", {
          endpoint: request.url,
          message: _error,
        })

        return {
          response: new Response(
            JSON.stringify({
              message: "Something went wrong",
            }),
            {
              status: 500,
            }
          ),
        }
      }
    },
    endpoints: {
      issueSubmissionVerification: createAuthEndpoint.serverOnly(
        {
          method: "POST",
          body: z.object({
            submissionId: z.string().min(1),
            userId: z.string().min(1),
            mediaIds: z.array(z.uuid()).min(1),
            role: z.enum(["submitter", "subscriber"]),
          }),
        },
        async (ctx) => {
          const user = await ctx.context.internalAdapter.findUserById(
            ctx.body.userId
          )
          if (!user)
            throw new APIError("BAD_REQUEST", { message: "User not found" })
          const token = await submissionVerification().issue({
            ...ctx.body,
            email: user.email,
          })
          return ctx.json({ token })
        }
      ),
      confirmSubmission: createAuthEndpoint.serverOnly(
        {
          method: "POST",
          body: z.object({
            submissionId: z.string().min(1),
            token: z.string().regex(/^[a-f0-9]{64}$/),
          }),
        },
        async (ctx) => {
          const repository = submissionVerification()
          let claim
          try {
            claim = await repository.inspect(
              ctx.body.submissionId,
              ctx.body.token
            )
          } catch {
            throw new APIError("BAD_REQUEST", {
              message: "Invalid, expired, or already used verification link",
            })
          }
          const user = await ctx.context.internalAdapter.findUserById(
            claim.userId
          )
          if (
            !user ||
            user.email.toLowerCase() !== claim.email ||
            ("banned" in user && user.banned)
          ) {
            throw new APIError("BAD_REQUEST", {
              message: "Verification link is no longer valid",
            })
          }
          if (!user.emailVerified) {
            await ctx.context.options.emailVerification?.beforeEmailVerification?.(
              user,
              ctx.request
            )
          }
          await repository.confirm(claim, ctx.body.token)
          const verifiedUser = await ctx.context.internalAdapter.findUserById(
            user.id
          )
          if (
            !verifiedUser?.emailVerified ||
            verifiedUser.email.toLowerCase() !== claim.email
          ) {
            throw new APIError("BAD_REQUEST", {
              message: "Verification link is no longer valid",
            })
          }
          if (!user.emailVerified) {
            await ctx.context.options.emailVerification?.afterEmailVerification?.(
              verifiedUser,
              ctx.request
            )
          }
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            true
          )
          if (!session)
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Unable to start session",
            })
          await setSessionCookie(ctx, { session, user: verifiedUser }, true)
          return ctx.json({ role: claim.role, mediaIds: claim.mediaIds })
        }
      ),
      createUserOnly: createAuthEndpoint.serverOnly(
        {
          method: "POST",
          body: z.object({
            email: z.email().trim().toLowerCase(),
            firstName: z.string().trim().max(100).optional(),
            lastName: z.string().trim().max(100).optional(),
          }),
          metadata: {
            $Infer: {
              body: {} as {
                firstName?: string
                lastName?: string
                email: string
              } /*& AdditionalUserFieldsInput<O>*/,
            },
            openapi: {
              description: "Sign up a user using email",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        email: {
                          type: "string",
                          description: "The email of the user",
                        },
                        firstName: {
                          type: "string",
                          description: "The first name of the user",
                        },
                        lastName: {
                          type: "string",
                          description: "The last name of the user",
                        },
                      },
                      required: ["email"],
                    },
                  },
                },
              },
              responses: {
                "200": {
                  description: "Successfully created user",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          user: {
                            type: "object",
                            properties: {
                              id: {
                                type: "string",
                                description:
                                  "The unique identifier of the user",
                              },
                              email: {
                                type: "string",
                                format: "email",
                                description: "The email address of the user",
                              },
                              name: {
                                type: "string",
                                description: "The name of the user",
                              },
                              firstName: {
                                type: "string",
                                description: "The first name of the user",
                              },
                              lastName: {
                                type: "string",
                                description: "The last name of the user",
                              },
                              image: {
                                type: "string",
                                format: "uri",
                                nullable: true,
                                description:
                                  "The profile image URL of the user",
                              },
                              emailVerified: {
                                type: "boolean",
                                description:
                                  "Whether the email has been verified",
                              },
                              createdAt: {
                                type: "string",
                                format: "date-time",
                                description: "When the user was created",
                              },
                              updatedAt: {
                                type: "string",
                                format: "date-time",
                                description: "When the user was last updated",
                              },
                            },
                            required: [
                              "id",
                              "email",
                              "emailVerified",
                              "createdAt",
                              "updatedAt",
                            ],
                          },
                        },
                        required: ["user"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          const { email, ...additionalFields } = ctx.body
          const dbUser =
            await ctx.context.internalAdapter.findUserByEmail(email)
          if (dbUser?.user) {
            ctx.context.logger.info(
              `Sign-up attempt for existing email: ${email}`
            )
            return ctx.json({
              user: {
                id: dbUser.user.id,
                email: dbUser.user.email,
                name: dbUser.user.name,
                image: dbUser.user.image,
                emailVerified: dbUser.user.emailVerified,
                createdAt: dbUser.user.createdAt,
                updatedAt: dbUser.user.updatedAt,
              },
            })
          }

          const additionalData = parseUserInput(
            ctx.context.options,
            additionalFields,
            "create"
          )

          let createdUser: User
          try {
            //TODO: how to Omit name?
            createdUser = await ctx.context.internalAdapter.createUser(
              {
                email: email.toLowerCase(),
                name:
                  additionalData.firstName && additionalData.lastName
                    ? `${additionalData.firstName} ${additionalData.lastName}`
                    : (additionalData.firstName ??
                      additionalData.lastName ??
                      ""),
                ...additionalData,
                emailVerified: false,
              },
              ctx
            )
            if (!createdUser) {
              throw new APIError("BAD_REQUEST", {
                message: "Failed to create user",
              })
            }
          } catch (e) {
            const existing =
              await ctx.context.internalAdapter.findUserByEmail(email)
            if (existing?.user) return ctx.json({ user: existing.user })
            if (isDevelopment) {
              ctx.context.logger.error("Failed to create user", e)
            }
            if (e instanceof APIError) {
              throw e
            }
            throw new APIError("UNPROCESSABLE_ENTITY", {
              message: "Failed to create user",
              details: e,
            })
          }
          if (!createdUser) {
            throw new APIError("UNPROCESSABLE_ENTITY", {
              message: "Failed to create user",
            })
          }

          return ctx.json({
            user: {
              id: createdUser.id,
              email: createdUser.email,
              name: createdUser.name,
              image: createdUser.image,
              emailVerified: createdUser.emailVerified,
              createdAt: createdUser.createdAt,
              updatedAt: createdUser.updatedAt,
            },
          })
        }
      ),
    },
  } satisfies BetterAuthPlugin
}
