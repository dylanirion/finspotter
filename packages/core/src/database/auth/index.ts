import "server-only"

import { site } from "@finspotter/config/site"
import { Template as ResetPasswordEmail } from "@finspotter/email/templates/ResetPassword"
import { Template as VerifyEmail } from "@finspotter/email/templates/VerifyEmail"
import { betterAuth } from "better-auth" //todo better-auth/minimal
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin, organization } from "better-auth/plugins"

//import { Resource } from "sst"

import { db } from "../_drizzle"
import schema from "../_drizzle/schema"
import { sendMail } from "../../email"
import { authPlugin } from "./plugin"

export type Session = typeof auth.$Infer.Session

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      sendMail(
        user.email,
        //`${Resource.Email.from} <${Resource.Email.noreply}>`,
        "",
        `Reset Password Request for ${site.title}`,
        ResetPasswordEmail({ title: site.title, url: url })
      )
    },
  },
  emailVerification: {
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      sendMail(
        user.email,
        //`${Resource.Email.from} <${Resource.Email.noreply}>`,
        "",
        `Verfiy your Email Address for ${site.title}`,
        VerifyEmail({ title: site.title, url: url })
      )
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.usersTable,
      account: schema.accountsTable,
      session: schema.sessionsTable,
      verification: schema.verificationTokensTable,
      organization: schema.organizationsTable,
      member: schema.membersTable,
      invitations: schema.invitationsTable,
    },
  }),
  user: {
    additionalFields: {
      firstName: {
        type: "string",
      },
      lastName: {
        type: "string",
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
  },
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: async (user) =>
        "role" in user && user.role === "admin",
      schema: {
        organization: {
          additionalFields: {
            short_name: {
              type: "string",
              input: true,
              required: false,
            },
          },
        },
      },
    }),
    authPlugin(),
    nextCookies(),
  ],
  advanced: {
    database: {
      joins: true,
    },
  },
})
