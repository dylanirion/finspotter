import "server-only"

import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise"
import { Resource } from "sst"

import { getClient } from "../client"

const client = getClient(RecaptchaEnterpriseServiceClient, {
  credentials: {
    universe_domain: "googleapis.com",
    type: "external_account",
    audience: `//iam.googleapis.com/${Resource.AwsPoolProvider.name}`,
    subject_token_type: "urn:ietf:params:aws:token-type:aws4_request",
    token_url: "https://sts.googleapis.com/v1/token",
    credential_source: {
      environment_id: "aws1",
      region_url:
        "http://169.254.169.254/latest/meta-data/placement/availability-zone",
      url: "http://169.254.169.254/latest/meta-data/iam/security-credentials",
      regional_cred_verification_url:
        "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15",
    },
  },
})

export async function isValidReCaptcha(
  reCaptchaToken: string,
  minimumScore = 0.5
) {
  console.debug(`reCAPTCHA token:`, `${reCaptchaToken.substring(0, 15)}...`)
  try {
    const projectPath = client.projectPath(Resource.AwsPoolProvider.project)
    const [response] = await client.createAssessment({
      assessment: {
        event: {
          token: reCaptchaToken,
          siteKey: process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY,
        },
      },
      parent: projectPath,
    })
    if (!response.tokenProperties?.valid)
      throw new Error(
        `reCAPTCHA verification failed: ${response.tokenProperties?.invalidReason}`
      )

    if (
      (response.riskAnalysis?.score &&
        response.riskAnalysis.score < minimumScore) ||
      !response.riskAnalysis?.score
    )
      throw new Error(
        `reCAPTCHA score too low: ${response.riskAnalysis?.score}`
      )
    console.debug(`reCAPTCHA score:`, response.riskAnalysis?.score)
  } catch (error) {
    console.error("reCAPTCHA validation error:", error)
    throw error
  }
}

export function validateReCaptcha(reCaptchaToken: string | undefined) {
  if (!reCaptchaToken) throw new Error("Missing token")
  return isValidReCaptcha(reCaptchaToken)
}