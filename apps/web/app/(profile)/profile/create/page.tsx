import React from "react"
import { type Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Profile",
}
//TODO: redirect to profile if already exists, i.e. email not verified
export default async function CreateProfilePage() {
  return (
    <>
      <div>CREATE PROFILE!</div>
      <div>edit name</div>
      <div>set password</div>
      <div>etc</div>
    </>
  )
}
