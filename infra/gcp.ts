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

/*
import * as gcp from "@pulumi/gcp";

// Enable the Maps JavaScript API
const mapsApi = new gcp.projects.Service("maps-js-api", {
    service: "maps-backend.googleapis.com", // Official service name
});

// Enable the Places API
const placesApi = new gcp.projects.Service("places-api", {
    service: "places-backend.googleapis.com",
});

const googleMapsKey = new gcp.projects.ApiKey("google-maps-key", {
    displayName: "Maps Production Key",
    restrictions: {
        // Restrict this key to only work with Maps APIs
        apiTargets: [
            { service: "maps-backend.googleapis.com" },
            { service: "places-backend.googleapis.com" },
        ],
        // Restrict to your specific website domain for security
        browserKeyRestrictions: {
            allowedReferrers: ["https://yourdomain.com*"],
        },
    },
}, { dependsOn: [mapsApi, placesApi] }); // Ensure APIs are enabled first

export const apiKey = googleMapsKey.keyString;
*/
