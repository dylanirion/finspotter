declare namespace NodeJS {
  interface ProcessEnv {
    AWS_PROFILE: Input<string> | undefined
    AWS_REGION: Input<Region> | undefined
    GCP_PROJECT: Input<Region> | undefined
  }
}
