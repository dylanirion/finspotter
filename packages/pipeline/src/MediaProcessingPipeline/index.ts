// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import { StateMachine } from "../StepFunction"
import { physicalName } from "../StepFunction/sst-helpers"
import { createStateMachine } from "./createStateMachine"
import {
  type DetectionFunction,
  type ExtractionFunction,
  type MatchRefinementFunction,
  type PipelineBucket,
  type PipelinePackage,
  type PipelinePackageWithAnnotation,
  type SearchFunction,
} from "./PipelinePackage"

export class MediaProcessingPipeline extends $util.ComponentResource {
  private _detectionFunctions: Record<string, ReturnType<DetectionFunction>>
  private _extractionFunctions: Record<string, ReturnType<ExtractionFunction>>
  private _searchFunctions: Record<string, ReturnType<SearchFunction>>
  private _refineFunctions: Record<string, ReturnType<MatchRefinementFunction>>
  private _pipeline: StateMachine

  constructor(
    name: string,
    args: {
      packages: Array<PipelinePackage | PipelinePackageWithAnnotation>
      bucket: PipelineBucket | sst.Linkable<{ name: string }>
      bus: aws.cloudwatch.EventBus
      table: sst.aws.Dynamo
    },
    opts?: $util.ComponentResourceOptions
  ) {
    super("finspotter:pipeline:MediaProcessingPipeline", name, args, opts)

    // TODO: persist extension function registrations in db instead of linking them as properties?
    const { bucket, bus, packages, table } = args
    if (!("arn" in bucket) && packages.length) {
      throw new Error(
        "Pipeline extensions require an AWS bucket; none can run against the development storage link"
      )
    }
    const awsBucket = "arn" in bucket ? bucket : undefined

    const detectionFunctions = (awsBucket ? packages : []).reduce(
      (acc, { name, detect }) => {
        if (detect) acc[name] = detect({ bucket: awsBucket!, table })
        return acc
      },
      {} as Record<string, ReturnType<DetectionFunction>>
    )
    const extractionFunctions = (awsBucket ? packages : []).reduce(
      (acc, { name, extract }) => {
        if (extract) acc[name] = extract({ bucket: awsBucket!, table })
        return acc
      },
      {} as Record<string, ReturnType<ExtractionFunction>>
    )
    const searchFunctions = (awsBucket ? packages : []).reduce(
      (acc, { name, search }) => {
        if (search)
          for (const [type, fn] of Object.entries(search)) {
            acc[`${name}:${type}`] = fn({ bucket: awsBucket!, table, bus })
          }
        return acc
      },
      {} as Record<string, ReturnType<SearchFunction>>
    )
    const refineFunctions = (awsBucket ? packages : []).reduce(
      (acc, { name, refine }) => {
        if (refine) acc[name] = refine({ bucket: awsBucket!, table })
        return acc
      },
      {} as Record<string, ReturnType<MatchRefinementFunction>>
    )

    this._detectionFunctions = detectionFunctions
    this._extractionFunctions = extractionFunctions
    this._searchFunctions = searchFunctions
    this._refineFunctions = refineFunctions
    this._pipeline = createStateMachine(name, table)
    createRolePolicies(this._pipeline.role)

    function createRolePolicies(role: aws.iam.Role) {
      if (
        !Object.values(detectionFunctions).length &&
        !Object.values(extractionFunctions).length &&
        !Object.values(searchFunctions).length &&
        !Object.values(refineFunctions).length
      )
        return

      new aws.iam.RolePolicy(
        `${name}InvokeFnsSfnRolePolicy`,
        {
          name: physicalName(256, `${name}InvokeFnsSfnRolePolicy`),
          role: role.name,
          policy: $util
            .all(
              Object.values({
                ...detectionFunctions,
                ...extractionFunctions,
                ...searchFunctions,
                ...refineFunctions,
              }).map((func) => func.arn)
            )
            .apply(async (arns) =>
              aws.iam
                .getPolicyDocument({
                  version: "2012-10-17",
                  statements: [
                    {
                      effect: "Allow",
                      actions: ["lambda:InvokeFunction"],
                      resources: arns,
                    },
                    {
                      effect: "Allow",
                      actions: [
                        "logs:CreateLogDelivery",
                        "logs:GetLogDelivery",
                        "logs:UpdateLogDelivery",
                        "logs:DeleteLogDelivery",
                        "logs:ListLogDeliveries",
                        "logs:PutResourcePolicy",
                        "logs:DescribeResourcePolicies",
                        "logs:DescribeLogGroups",
                      ],
                      resources: ["*"],
                    },
                  ],
                })
                .then((doc) => doc.json)
            ),
        },
        { parent: role }
      )
    }
  }

  public get pipeline() {
    return this._pipeline.arn
  }

  public get stateMachine() {
    return this._pipeline
  }

  public get detectionFunctions() {
    return Object.entries(this._detectionFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }

  public get extractionFunctions() {
    return Object.entries(this._extractionFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }

  public get searchFunctions() {
    return Object.entries(this._searchFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }

  public get refineFunctions() {
    return Object.entries(this._refineFunctions).reduce(
      (acc, [type, fn]) => {
        acc[type] = fn.name
        return acc
      },
      {} as Record<string, $util.Output<string>>
    )
  }
}

sst.Linkable.wrap(
  MediaProcessingPipeline,
  (resource: MediaProcessingPipeline) => ({
    properties: {
      pipeline: resource.pipeline,
      detectionFunctions: resource.detectionFunctions,
      extractionFunctions: resource.extractionFunctions,
      searchFunctions: resource.searchFunctions,
      refineFunctions: resource.refineFunctions,
    },
    include: [
      sst.aws.permission({
        actions: ["states:StartExecution"],
        resources: [resource.pipeline],
      }),
    ],
  })
)
