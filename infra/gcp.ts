sst.Linkable.wrap(gcp.iam.WorkloadIdentityPoolProvider, (provider) => ({
  properties: { name: provider.name, project: gcp.config.project! },
}))

export const gcpIdentityPool = new gcp.iam.WorkloadIdentityPool(
  "AwsPool",
  {
    workloadIdentityPoolId: "aws-pool",
    disabled: false,
  }
  //{ import: "aws-pool" }
)

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
  //{ import: `${gcp.organizations.getProject({}).then(proj => proj.id)}/locations/global/workloadIdentityPools/{gcpIdentityPool.workloadIdentityPoolId}/providers/aws-pool-provider" }
  //{ import: "projects/finspotter/locations/global/workloadIdentityPools/aws-pool/providers/aws-pool-provider" }
)

new gcp.projects.IAMMember("AwsPoolRecaptchaPermission", {
  project: gcp.config.project!,
  role: "roles/recaptchaenterprise.agent",
  member: $util.interpolate`principalSet://iam.googleapis.com/${gcpIdentityPool.name}/*`,
})

//TODO: enterprise!?
export const recaptcha = new gcp.recaptcha.EnterpriseKey("Recaptcha", {
  displayName: $dev ? "Development" : "Production",
  webSettings: {
    integrationType: "SCORE",
    //TODO: domain!
    allowedDomains: [$dev ? "localhost" : "caperadd.com"],
  },
  ...($dev && {
    testingOptions: {
      testingScore: 1,
    },
  }),
})

const mapsApi = new gcp.projects.Service("MapsJavaScriptApi", {
  project: gcp.config.project,
  service: "maps-backend.googleapis.com",
  disableOnDestroy: false,
})

const placesApi = new gcp.projects.Service("PlacesApi", {
  project: gcp.config.project,
  service: "places-backend.googleapis.com",
  disableOnDestroy: false,
})

const apiKeysApi = new gcp.projects.Service("ApiKeysApi", {
  project: gcp.config.project,
  service: "apikeys.googleapis.com",
  disableOnDestroy: false,
})

const googleMapsProvider = new gcp.Provider("GoogleMapsProvider", {
  project: gcp.config.project,
  billingProject: gcp.config.project,
  userProjectOverride: true,
})

const googleMapsKeyName = `finspotter-maps-${$app.stage}`
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-")
  .slice(0, 63)
  .replace(/-+$/, "")

const googleMapsKey = new gcp.projects.ApiKey(
  "GoogleMapsApiKey",
  {
    name: googleMapsKeyName,
    project: gcp.config.project,
    displayName: $dev
      ? "Finspotter Maps Development"
      : "Finspotter Maps Production",
    restrictions: {
      apiTargets: [
        { service: "maps-backend.googleapis.com" },
        { service: "places-backend.googleapis.com" },
      ],
      browserKeyRestrictions: {
        allowedReferrers: $dev
          ? ["http://localhost:3000/*"]
          : [`https://${$app.stage}.fin.caperadd.com/*`],
      },
    },
  },
  {
    dependsOn: [apiKeysApi, mapsApi, placesApi],
    provider: googleMapsProvider,
  }
)

export const googleMapsApiKey = googleMapsKey.keyString
