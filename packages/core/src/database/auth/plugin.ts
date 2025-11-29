import { generateId, type BetterAuthPlugin, type User } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { parseUserInput } from "better-auth/db"
import { z } from "zod"

import { validateReCaptcha } from "../../recaptcha"

const getDate = (span: number, unit: "sec" | "ms" = "ms") => {
  return new Date(Date.now() + (unit === "sec" ? span * 1000 : span))
}

const nodeENV =
  (typeof process !== "undefined" && process.env && process.env.NODE_ENV) || ""
const isDevelopment = nodeENV === "dev" || nodeENV === "development"

export const authPlugin = () => {
  return {
    id: "auth-plugin",
    onRequest: async (request, ctx) => {
      try {
        if (
          !["/sign-up/email", "/sign-in/email", "/forget-password"].some(
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
      // Overwrites "forget-password" endpoint with a version that also checks for existence of account
      // https://github.com/better-auth/better-auth/blob/c91c6830d4bbf8fb3782bb09b1860be7d51cbdec/packages/better-auth/src/api/routes/reset-password.ts#L144
      forgetPassword: createAuthEndpoint(
        "/forget-password",
        {
          method: "POST",
          body: z.object({
            /**
             * The email address of the user to send a password reset email to.
             */
            email: z.email().meta({
              description:
                "The email address of the user to send a password reset email to",
            }),
            /**
             * The URL to redirect the user to reset their password.
             * If the token isn't valid or expired, it'll be redirected with a query parameter `?
             * error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?
             * token=VALID_TOKEN
             */
            redirectTo: z
              .string()
              .meta({
                description:
                  "The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?token=VALID_TOKEN",
              })
              .optional(),
          }),
          metadata: {
            openapi: {
              description: "Send a password reset email to the user",
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          status: {
                            type: "boolean",
                          },
                          message: {
                            type: "string",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          if (!ctx.context.options.emailAndPassword?.sendResetPassword) {
            ctx.context.logger.error(
              "Reset password isn't enabled. Please pass an emailAndPassword.sendResetPassword function in your auth config!"
            )
            throw new APIError("BAD_REQUEST", {
              message: "Reset password isn't enabled",
            })
          }
          const { email, redirectTo } = ctx.body

          const user = await ctx.context.internalAdapter.findUserByEmail(
            email,
            {
              includeAccounts: true,
            }
          )
          const account = user?.accounts.find(
            (account) => account.providerId === "credential"
          )
          if (!user || !account) {
            ctx.context.logger.error("Reset Password: Account not found", {
              email,
            })
            return ctx.json({
              status: true,
              message:
                "If this email exists in our system, check your email for the reset link",
            })
          }
          const defaultExpiresIn = 60 * 60 * 1
          const expiresAt = getDate(
            ctx.context.options.emailAndPassword.resetPasswordTokenExpiresIn ||
              defaultExpiresIn,
            "sec"
          )
          const verificationToken = generateId(24)
          await ctx.context.internalAdapter.createVerificationValue(
            {
              value: user.user.id,
              identifier: `reset-password:${verificationToken}`,
              expiresAt,
            },
            ctx
          )
          const callbackURL = redirectTo ? encodeURIComponent(redirectTo) : ""
          const url = `${ctx.context.baseURL}/reset-password/${verificationToken}?callbackURL=${callbackURL}`
          await ctx.context.options.emailAndPassword.sendResetPassword(
            {
              user: user.user,
              url,
              token: verificationToken,
            },
            ctx.request
          )
          return ctx.json({
            status: true,
          })
        }
      ),
      // An endpoint "create/user" for creating a user (but no credential account)
      createUserOnly: createAuthEndpoint(
        "/create/user",
        {
          method: "POST",
          body: z.record(z.string(), z.any()),
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
          if (
            !ctx.context.options.emailAndPassword?.enabled ||
            ctx.context.options.emailAndPassword?.disableSignUp
          ) {
            throw new APIError("BAD_REQUEST", {
              message: "Email and password sign up is not enabled",
            })
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = ctx.body as any as User & {
            password: string
          } & {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any
          }
          const { email, ...additionalFields } = body
          const isValidEmail = z.string().email().safeParse(email)

          if (!isValidEmail.success) {
            throw new APIError("BAD_REQUEST", {
              message: "Invalid email",
            })
          }
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            additionalFields as any
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
