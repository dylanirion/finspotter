// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import { StateMachine } from "../StepFunction"
import { physicalName } from "../StepFunction/sst-helpers"
import { createStateMachine } from "./createStateMachine"
import {
  type DetectionFunction,
  type ExtractionFunction,
  type PipelineBucket,
  type PipelinePackage,
  type PipelinePackageWithAnnotation,
} from "./PipelinePackage"

export class MediaProcessingPipeline extends $util.ComponentResource {
  private _detectionFunctions: Record<string, ReturnType<DetectionFunction>>
  private _extractionFunctions: Record<string, ReturnType<ExtractionFunction>>
  private _pipeline: StateMachine

  constructor(
    name: string,
    args: {
      packages: Array<PipelinePackage | PipelinePackageWithAnnotation>
      bucket: PipelineBucket
      table: sst.aws.Dynamo
    },
    opts?: $util.ComponentResourceOptions
  ) {
    super("finspotter:pipeline:MediaProcessingPipeline", name, args, opts)

    // TODO: persist extension function registrations in db instead of linking them as properties?
    const { bucket, packages, table } = args

    const detectionFunctions = packages.reduce(
      (acc, { name, detect }) => {
        if (detect) acc[name] = detect({ bucket, table })
        return acc
      },
      {} as Record<string, ReturnType<DetectionFunction>>
    )
    const extractionFunctions = packages.reduce(
      (acc, { name, extract }) => {
        if (extract) acc[name] = extract({ bucket, table })
        return acc
      },
      {} as Record<string, ReturnType<ExtractionFunction>>
    )
    if (
      Object.keys(detectionFunctions).length > 0 &&
      Object.keys(extractionFunctions).length === 0
    ) {
      throw new Error(
        "Media processing requires an extraction extension when detection is configured"
      )
    }

    this._detectionFunctions = detectionFunctions
    this._extractionFunctions = extractionFunctions
    this._pipeline = createStateMachine(name, table)
    createRolePolicies(this._pipeline.role)

    function createRolePolicies(role: aws.iam.Role) {
      if (
        !Object.values(detectionFunctions).length &&
        !Object.values(extractionFunctions).length
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

}

sst.Linkable.wrap(
  MediaProcessingPipeline,
  (resource: MediaProcessingPipeline) => ({
    properties: {
      pipeline: resource.pipeline,
      detectionFunctions: resource.detectionFunctions,
      extractionFunctions: resource.extractionFunctions,
    },
    include: [
      sst.aws.permission({
        actions: ["states:StartExecution"],
        resources: [resource.pipeline],
      }),
    ],
  })
)
