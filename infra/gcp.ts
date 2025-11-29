sst.Linkable.wrap(gcp.iam.WorkloadIdentityPoolProvider, (provider) => ({
  properties: { name: provider.name, project: gcp.config.project! },
}))

export const gcpIdentityPool = new gcp.iam.WorkloadIdentityPool("AwsPool", {
  workloadIdentityPoolId: "aws-pool",
  disabled: false,
})

export const gcpIdentityProvider = new gcp.iam.WorkloadIdentityPoolProvider(
  "AwsPoolProvider",
  {
    workloadIdentityPoolId: gcpIdentityPool.workloadIdentityPoolId,
    workloadIdentityPoolProviderId: "aws-pool-provider",
    //attributeCondition: 'attribute.aws_role=="arn:aws:sts::999999999999:assumed-role/stack-eu-central-1-lambdaRole"',
    attributeMapping: {
      "google.subject": "assertion.arn",
      "attribute.aws_role":
        "assertion.arn.contains('assumed-role') ? assertion.arn.extract('{account_arn}assumed-role/') + 'assumed-role/' + assertion.arn.extract('assumed-role/{role_name}/') : assertion.arn",
    },
    aws: {
      accountId: aws.getCallerIdentityOutput({}).accountId,
    },
  }
)

new gcp.projects.IAMMember("AwsPoolRecaptchaPermission", {
  project: gcp.config.project!,
  role: "roles/recaptchaenterprise.agent",
  member: $util.interpolate`principalSet://iam.googleapis.com/${gcpIdentityPool.name}/*`,
})

export const recaptcha = new gcp.recaptcha.EnterpriseKey("Recaptcha", {
  displayName: $dev ? "Development" : "Production",
  webSettings: {
    integrationType: "SCORE",
    allowedDomains: [$dev ? "localhost" : "caperadd.com"],
  },
  ...($dev && {
    testingOptions: {
      testingScore: 1,
    },
  }),
})
