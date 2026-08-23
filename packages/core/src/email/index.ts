import "server-only"

import { type JSXElementConstructor, type ReactElement } from "react"
import { render } from "jsx-email"
import { createTransport } from "nodemailer"
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { getClient } from "../client"

const sesClient = getClient(SESv2Client, {
  logger: {
    ...console,
    debug(..._args: unknown[]) {},
    trace(..._args: unknown[]) {},
  },
})

const transporter = createTransport({
  SES: { sesClient, SendEmailCommand },
})

//TODO: put a queue infront of this
export async function sendMail(
  to: string | undefined,
  from: string,
  subject: string,
  template: ReactElement<unknown, string | JSXElementConstructor<unknown>>
) {
  return await transporter
    .sendMail({
      to,
      from,
      subject,
      html: await render(template, {
        minify: true,
        inlineCss: true,
      }),
    })
    .then((result) => {
      const failed = result.rejected
      if (failed.length) {
        throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`)
      }
    })
}
