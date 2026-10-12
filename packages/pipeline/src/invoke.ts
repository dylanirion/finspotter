import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import {
  SFNClient,
  StartExecutionCommand,
  type StartExecutionCommandOutput,
} from "@aws-sdk/client-sfn"
import {
  type JobProps,
  type PipelineRepository,
  type PipelineRun,
} from "@finspotter/core/pipeline"
import { Resource } from "sst"

export type {
  DetectionItem,
  DetectionResponse,
  ExtractionResponse,
  JobProps,
  MediaItem,
  MediaResponse,
  PipelineStatus,
  StatusItem,
} from "@finspotter/core/pipeline"

const sfn = new SFNClient({
  logger: {
    ...console,
    debug(..._args) {},
    trace(..._args) {},
  },
})
const lambda = new LambdaClient({
  logger: {
    ...console,
    debug(..._args) {},
    trace(..._args) {},
  },
})

export async function invokePipelineFunction<T>(
  functionName: string,
  payload: unknown,
  client: LambdaClient = lambda
): Promise<T> {
  const response = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
    })
  )
  const body = response.Payload
    ? JSON.parse(new TextDecoder().decode(response.Payload))
    : undefined
  if (response.FunctionError) {
    throw new Error(
      `Pipeline function ${functionName} failed: ${JSON.stringify(body)}`
    )
  }
  return body as T
}

async function startExecution<
  D extends string | undefined = undefined,
  E extends string | undefined = undefined,
  S extends string | undefined = undefined,
  R extends string[] | undefined = undefined,
>(
  client: SFNClient,
  stateMachineArn: string,
  input: JobProps<D, E, S, R>
): Promise<StartExecutionCommandOutput> {
  return client.send(
    new StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify(input),
    })
  )
}

export function createAwsPipelineRepository({
  stateMachineArn,
  client = sfn,
}: {
  stateMachineArn: string
  client?: SFNClient
}): PipelineRepository {
  return {
    async startJob<
      D extends string | undefined = undefined,
      E extends string | undefined = undefined,
      S extends string | undefined = undefined,
      R extends string[] | undefined = undefined,
    >(input: JobProps<D, E, S, R>): Promise<PipelineRun> {
      const response = await startExecution(client, stateMachineArn, input)
      if (!response.executionArn || !response.startDate) {
        throw new Error("Step Functions did not return an execution handle")
      }

      return {
        id: response.executionArn,
        startedAt: response.startDate,
      }
    },
  }
}

export async function invoke<
  D extends string | undefined = undefined,
  E extends string | undefined = undefined,
  S extends string | undefined = undefined,
  R extends string[] | undefined = undefined,
>(input: JobProps<D, E, S, R>) {
  const response = await startExecution(
    sfn,
    Resource.SubmissionReviewPipeline.pipeline,
    input
  )
  return response.$metadata.httpStatusCode
}

export async function invokeMediaProcessing<
  D extends string | undefined = undefined,
  E extends string | undefined = undefined,
>(input: JobProps<D, E>) {
  const response = await startExecution(
    sfn,
    Resource.SubmissionReviewPipeline.mediaProcessingJob,
    input
  )
  if (!response.executionArn || !response.startDate) {
    throw new Error("Step Functions did not return a media processing handle")
  }

  return {
    id: response.executionArn,
    startedAt: response.startDate,
  }
}

export async function invokeMediaPipeline<
  D extends string | undefined = undefined,
  E extends string | undefined = undefined,
>(input: JobProps<D, E>) {
  const response = await startExecution(
    sfn,
    Resource.MediaProcessingPipeline.pipeline,
    input
  )
  if (!response.executionArn || !response.startDate) {
    throw new Error("Step Functions did not return a media pipeline handle")
  }

  return {
    id: response.executionArn,
    startedAt: response.startDate,
  }
}
