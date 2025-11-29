import React from "react"
import { type Metadata } from "next"
import { redirect } from "next/navigation"
import { verifyEmail } from "lib/auth"

export const metadata: Metadata = {
  title: "Confirm Submission",
}

//TODO: option to register?
export default async function ConfirmSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ confirm: string }>
  searchParams: Promise<{ token: string }>
}) {
  const { confirm } = await params
  const { token } = await searchParams
  if (!token) redirect("/")
  //TODO: this throws and returns something like
  /*
{
  status: 'UNAUTHORIZED',
  body: [Object],
  headers: {},
  statusCode: 401,
  digest: '1968202576'
}
  or 
{ status: true, user: null }
*/
  const verified = await verifyEmail({
    query: {
      token,
    },
  })
  //TODO: token seems to be an encoded jwt, NOT SINGLE USE! so need a way to redirect if it's been used already. or include submissionId in jwt and write custom verify endpoint for submisions?
  console.log(verified)
  //TODO: set verified in dynamo or db for subscriptions
  return (
    <>
      <h1>Submission Verified!</h1>
      <p>
        Your encounter submission has been verified. You&apos;ll receive
        notifications when your animal is spotted again.
      </p>
      <div className="mt-8">
        <h2>Create an Account (Optional)</h2>
        <p>Want to manage your submissions and communication preferences?</p>
      </div>
    </>
  )
}
