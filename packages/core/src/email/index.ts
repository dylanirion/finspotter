import "server-only"

import { type JSXElementConstructor, type ReactElement } from "react"
import { render } from "jsx-email"
import { createTransport } from "nodemailer"
import SMTPTransport from "nodemailer/lib/smtp-transport"
import { Resource } from "sst"

const { smtp } = Resource.Email

const transporter = createTransport({
  ...smtp,
  port: Number(smtp.port),
  secure: true,
} satisfies SMTPTransport.Options)

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
