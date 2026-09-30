// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../.sst/platform/config.d.ts" />

import {
  type MatchRefinementFunction,
  type PipelineBucket,
  type PipelinePackage,
  type PipelinePackageWithAnnotation,
  type SearchFunction,
} from "../MediaProcessingPipeline/PipelinePackage"
import { physicalName } from "../StepFunction/sst-helpers"
import { createStateMachine } from "./createStateMachine"

export class SimilaritySearchPipeline extends $util.ComponentResource {
  private _searchFunctions: Record<string, ReturnType<SearchFunction>>
  private _refineFunctions: Record<string, ReturnType<MatchRefinementFunction>>
  private _pipeline: ReturnType<typeof createStateMachine>

  constructor(
    name: string,
    args: {
      packages: Array<PipelinePackage | PipelinePackageWithAnnotation>
      bucket: PipelineBucket
      bus: aws.cloudwatch.EventBus
      table: sst.aws.Dynamo
    },
    opts?: $util.ComponentResourceOptions
  ) {
    super("finspotter:pipeline:SimilaritySearchPipeline", name, args, opts)

    // TODO: persist extension function registrations in db instead of linking them as properties?
    const { bucket, bus, packages, table } = args
    const searchFunctions = packages.reduce(
      (acc, { name, search }) => {
        if (search)
          for (const [type, fn] of Object.entries(search)) {
            acc[`${name}:${type}`] = fn({ bucket, table, bus })
          }
        return acc
      },
      {} as Record<string, ReturnType<SearchFunction>>
    )
    const refineFunctions = packages.reduce(
      (acc, { name, refine }) => {
        if (refine) acc[name] = refine({ bucket, table })
        return acc
      },
      {} as Record<string, ReturnType<MatchRefinementFunction>>
    )

    this._searchFunctions = searchFunctions
    this._refineFunctions = refineFunctions
    this._pipeline = createStateMachine(name, table)
    createRolePolicy(this._pipeline.role)

    function createRolePolicy(role: aws.iam.Role) {
      const functions = { ...searchFunctions, ...refineFunctions }
      if (!Object.keys(functions).length) return

      new aws.iam.RolePolicy(
        `${name}InvokeFnsSfnRolePolicy`,
        {
          name: physicalName(128, `${name}InvokeFnsSfnRolePolicy`),
          role: role.name,
          policy: $util
            .all(Object.values(functions).map((func) => func.arn))
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

  public get searchFunctions() {
    return Object.fromEntries(
      Object.entries(this._searchFunctions).map(([type, fn]) => [type, fn.name])
    ) as Record<string, $util.Output<string>>
  }

  public get refineFunctions() {
    return Object.fromEntries(
      Object.entries(this._refineFunctions).map(([type, fn]) => [type, fn.name])
    ) as Record<string, $util.Output<string>>
  }
}

sst.Linkable.wrap(
  SimilaritySearchPipeline,
  (resource: SimilaritySearchPipeline) => ({
    properties: {
      pipeline: resource.pipeline,
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
