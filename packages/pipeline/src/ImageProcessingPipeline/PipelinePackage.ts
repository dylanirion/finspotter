export interface ObjectLambdaConfig {
  type: string
  lambdaArn: $util.Output<string>
  olArn: $util.Output<string>
  olAlias: $util.Output<string>
}

export type DetectionFunction = ({
  bucket,
  table,
}: {
  bucket: aws.s3.BucketV2
  table: sst.aws.Dynamo
}) => $util.Output<aws.lambda.Function>

export type ExtractionFunction = ({
  bucket,
  table,
}: {
  bucket: aws.s3.BucketV2
  table: sst.aws.Dynamo
}) => $util.Output<aws.lambda.Function>

export type SearchFunction = ({
  bucket,
  table,
  bus,
}: {
  bucket: aws.s3.BucketV2
  table: sst.aws.Dynamo
  bus: aws.cloudwatch.EventBus
}) => $util.Output<aws.lambda.Function>

export type MatchRefinementFunction = ({
  bucket,
  table,
}: {
  bucket: aws.s3.BucketV2
  table: sst.aws.Dynamo
}) => $util.Output<aws.lambda.Function>

export type ScoringFunction = ({
  bucket,
  table,
}: {
  bucket: aws.s3.BucketV2
  table: sst.aws.Dynamo
}) => $util.Output<aws.lambda.Function>

type SearchType = "pairwise" | "indexed"

interface BasePipelineConfig {
  pkg: string
  name: string
  configType: string
}

export type PipelineConfig =
  | (BasePipelineConfig & { detect: DetectionFunction })
  | (BasePipelineConfig & { extract: ExtractionFunction })
  | (Omit<BasePipelineConfig, "configType"> & {
      search: Partial<Record<SearchType, SearchFunction>>
      configType: Partial<Record<SearchType, string>>
    })
  | (BasePipelineConfig & { refine: MatchRefinementFunction })
  | (BasePipelineConfig & { score: ScoringFunction })

//TODO: add citation to be displayed on about page
export class PipelinePackage {
  public readonly pkg: string
  public readonly name: string
  public detect?: DetectionFunction
  public extract?: ExtractionFunction
  public search?: Partial<Record<SearchType, SearchFunction>>
  public refine?: MatchRefinementFunction
  public score?: ScoringFunction
  public configType: string | Partial<Record<SearchType, string>>

  constructor(config: PipelineConfig) {
    this.pkg = config.pkg
    this.name = config.name
    if ("detect" in config) this.detect = config.detect
    if ("extract" in config) this.extract = config.extract
    if ("search" in config) this.search = config.search
    if ("refine" in config) this.refine = config.refine
    if ("score" in config) this.score = config.score
    this.configType = config.configType
  }
}

export class PipelinePackageWithAnnotation extends PipelinePackage {
  private _annotationType: string | undefined
  constructor(config: PipelineConfig) {
    super(config)
  }
  setAnnotationType(annotationType: string): PipelinePackage {
    if (!this.detect && !this.extract) {
      throw new Error(
        "Can only set annotation type on a PipelinePackage that defines a `detect` or `extract` function"
      )
    }
    this._annotationType = annotationType
    return this
  }

  get annotationType(): string | undefined {
    return this._annotationType
  }
}
