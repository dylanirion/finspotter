import {
  $,
  Choice,
  Custom,
  Dynamo,
  Fail,
  Map,
  Pass,
  StateMachine,
} from "../StepFunction"

export function createStateMachine(name: string, table: sst.aws.Dynamo) {
  const logGroup = new aws.cloudwatch.LogGroup(`${name}Log`, {
    name: `/aws/sfn/${$app.name}-${$app.stage}-${name}`,
    retentionInDays: 3,
  })
  const pipelineFailed = new Fail("Similarity Search Failed")
  const setStatusSearching = new Dynamo(
    "Set Status Searching",
    "updateItem",
    table,
    {
      Parameters: {
        Key: {
          pk: { "S.$": $.stringAt("$.submissionId") },
          sk: { S: "status" },
        },
        ExpressionAttributeNames: {
          "#GSI1PK": "gsi1pk",
          "#STATUS": "status",
          "#UPDATEDAT": "updated_at",
        },
        ExpressionAttributeValues: {
          ":gsi1pk": { S: "status" },
          ":status": {
            "S.$": $.format("searching ({})", "$.search.type"),
          },
          ":updatedat": { "S.$": $.stringAt("$$.State.EnteredTime") },
        },
        UpdateExpression:
          "SET #STATUS = :status, #GSI1PK = :gsi1pk, #UPDATEDAT = :updatedat",
      },
      ResultPath: $.DISCARD,
    }
  )
  const invokeSearch = new Custom("Invoke similarity search function", {
    Type: "Task",
    Resource: "arn:aws:states:::lambda:invoke",
    Parameters: {
      Payload: {
        "submissionId.$": $.stringAt("$.submissionId"),
        "payload.$": $.stringAt("$.payload"),
        "config.$": $.stringAt("$.config"),
        "expires.$": $.stringAt("$.expires"),
      },
      "FunctionName.$": $.stringAt("$.functionName"),
    },
    ResultSelector: {
      "merged.$": $.jsonMerge(
        "$$.Execution.Input",
        $.stringToJson(
          // eslint-disable-next-line no-useless-escape
          $.format('\\{\"payload\": {}\\}', $.jsonToString("$.Payload"))
        )
      ),
    },
    OutputPath: $.stringAt("$.merged"),
  }).addRetry({
    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
    IntervalSeconds: 2,
    MaxAttempts: 6,
    BackoffRate: 2,
  })
  const invokeRefinement = new Custom("Invoke match refinement function", {
    Type: "Task",
    Resource: "arn:aws:states:::lambda:invoke",
    Parameters: {
      Payload: {
        "submissionId.$": $.stringAt("$.submissionId"),
        "index.$": $.stringAt("$.refineFunctionIndex"),
        "payload.$": $.stringAt("$.payload"),
        "config.$": $.stringAt("$.function.config"),
        "expires.$": $.stringAt("$.expires"),
      },
      "FunctionName.$": $.stringAt("$.function.functionName"),
    },
    ResultPath: $.stringAt("$.payload"),
  }).addRetry({
    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
    IntervalSeconds: 2,
    MaxAttempts: 6,
    BackoffRate: 2,
  })
  const initRefinement = new Pass("Initialise match refinement loop", {
    Parameters: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$.payload"),
      refineFunctionIndex: 0,
      "numRefineFunctions.$": $.arrayLength("$.refine"),
      "expires.$": $.stringAt("$.expires"),
    },
  })
  const pullFunction = new Pass("Pull refinement function", {
    Parameters: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$.payload"),
      "refineFunctionIndex.$": $.stringAt("$.refineFunctionIndex"),
      "numRefineFunctions.$": $.stringAt("$.numRefineFunctions"),
      "function.$": `${$.arrayGetItem(
        "$$.Execution.Input.refine",
        "$.refineFunctionIndex"
      )}`,
      "expires.$": $.stringAt("$.expires"),
    },
  })
  const incrementIndex = new Pass("Increment index", {
    Parameters: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$.payload.Payload"),
      "refineFunctionIndex.$": $.mathAdd("$.refineFunctionIndex", 1),
      "numRefineFunctions.$": $.stringAt("$.numRefineFunctions"),
      "expires.$": $.stringAt("$.expires"),
    },
  })
  const getReviewResult = new Custom("Get Review Result", {
    Type: "Task",
    Resource: "arn:aws:states:::dynamodb:getItem",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      Key: {
        pk: { "S.$": $.stringAt("$.payload.pk") },
        sk: { "S.$": $.stringAt("$.payload.sk") },
      },
      ProjectionExpression: "#SCORE",
      ExpressionAttributeNames: {
        "#SCORE": "score",
      },
      ConsistentRead: true,
    },
    ResultPath: $.stringAt("$.reviewResult"),
  })
  const publishReviewReady = new Custom("Publish Review Ready", {
    Type: "Task",
    Resource: "arn:aws:states:::dynamodb:updateItem",
    Parameters: {
      TableName: table.name.apply(async (tableName) => tableName),
      Key: {
        pk: { "S.$": $.stringAt("$.payload.pk") },
        sk: { "S.$": $.stringAt("$.payload.sk") },
      },
      ConditionExpression: "attribute_exists(#SCORE)",
      ExpressionAttributeNames: {
        "#SCORE": "score",
        "#ITEMTYPE": "item_type",
        "#REVIEWSTATUS": "review_status",
        "#REVIEWSCORE": "review_score",
        "#REVIEWREADYAT": "review_ready_at",
        "#SOURCEQUERY": "source_query",
        "#SOURCEREF": "source_ref",
      },
      ExpressionAttributeValues: {
        ":itemType": { S: "pair_result" },
        ":reviewStatus": { S: "ready" },
        ":reviewScore": {
          "N.$": $.stringAt("$.reviewResult.Item.score.N"),
        },
        ":reviewReadyAt": {
          "S.$": $.stringAt("$$.State.EnteredTime"),
        },
        ":sourceQuery": {
          M: {
            pk: { "S.$": $.stringAt("$$.Execution.Input.payload[0][0].pk") },
            sk: { "S.$": $.stringAt("$$.Execution.Input.payload[0][0].sk") },
          },
        },
        ":sourceRef": {
          M: {
            pk: { "S.$": $.stringAt("$$.Execution.Input.payload[0][1].pk") },
            sk: { "S.$": $.stringAt("$$.Execution.Input.payload[0][1].sk") },
          },
        },
      },
      UpdateExpression:
        "SET #ITEMTYPE = :itemType, #REVIEWSTATUS = :reviewStatus, #REVIEWSCORE = :reviewScore, #REVIEWREADYAT = :reviewReadyAt, #SOURCEQUERY = :sourceQuery, #SOURCEREF = :sourceRef",
    },
    ResultPath: $.DISCARD,
  })
  const validateReviewScore = new Choice("Validate Review Score", {
    Choices: [
      {
        Variable: $.stringAt("$.reviewResult.Item.score.N"),
        IsPresent: true,
        Next: publishReviewReady,
      },
    ],
    Default: new Fail("Final pair result has no score"),
  })
  const reviewPublication = new Choice("Publish pair result for review?", {
    Choices: [
      {
        Variable: $.stringAt("$$.Execution.Input.pairsPrepared"),
        BooleanEquals: true,
        Next: getReviewResult.next(validateReviewScore),
      },
    ],
    Default: new Pass("Do not publish for review"),
  })
  const continueRefining = new Choice("Continue Refining?", {
    Choices: [
      {
        Variable: $.stringAt("$.refineFunctionIndex"),
        NumericLessThanPath: $.stringAt("$.numRefineFunctions"),
        Next: pullFunction.next(invokeRefinement),
      },
    ],
    Default: reviewPublication, //TODO: clustering should run before publication
  })
  const validateRefinementOutput = new Choice("Validate refinement output", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.payload.Payload.pk"), IsPresent: true },
          { Variable: $.stringAt("$.payload.Payload.sk"), IsPresent: true },
          { Variable: $.stringAt("$.payload.Payload.bucket"), IsPresent: true },
          { Variable: $.stringAt("$.payload.Payload.key"), IsPresent: true },
        ],
        Next: incrementIndex.next(continueRefining),
      },
    ],
    Default: new Fail("Invalid refinement output"),
  })
  const refinementLoop = initRefinement
    .next(pullFunction)
    .next(invokeRefinement)
  invokeRefinement.next(validateRefinementOutput)
  const refinementChoice = new Choice("Do match refinement?", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.payload"), IsPresent: true },
          { Variable: $.stringAt("$.refine[0]"), IsPresent: true },
        ],
        Next: refinementLoop,
      },
    ],
    Default: reviewPublication,
  })
  const validateSearchOutput = new Choice("Validate search output", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.payload.pk"), IsPresent: true },
          { Variable: $.stringAt("$.payload.sk"), IsPresent: true },
          { Variable: $.stringAt("$.payload.bucket"), IsPresent: true },
          { Variable: $.stringAt("$.payload.key"), IsPresent: true },
        ],
        Next: refinementChoice,
      },
    ],
    Default: new Fail("Invalid search output"),
  })
  const iterateFeatureSets = new Map("Iterate feature sets", {
    ItemsPath: $.stringAt("$.payload"),
    ItemSelector: {
      "submissionId.$": $.stringAt("$.submissionId"),
      "payload.$": $.stringAt("$$.Map.Item.Value"),
      "functionName.$": $.stringAt("$.search.functionName"),
      "config.$": $.stringAt("$.search.config"),
      "expires.$": $.stringAt("$.expires"),
    },
    //TODO: output is array for pairwise, single for indexed?
    ResultSelector: {
      "merged.$": $.jsonMerge(
        "$$.Execution.Input",
        $.stringToJson(
          // eslint-disable-next-line no-useless-escape
          $.format('\\{\"payload\": {}\\}', $.jsonToString("$[*].payload"))
        )
      ),
    },
    OutputPath: $.stringAt("$.merged"),
    ItemProcessor: invokeSearch.next(validateSearchOutput),
  }).addCatch({
    ErrorEquals: ["States.ALL"],
    ResultPath: $.stringAt("$.error"),
    Next: pipelineFailed,
  })
  const searchChoice = new Choice("Do Search (Pairwise or Indexed)?", {
    Choices: [
      {
        And: [
          { Variable: $.stringAt("$.payload[0][1]"), IsPresent: true },
          { Variable: $.stringAt("$.pairsPrepared"), BooleanEquals: true },
          {
            Variable: $.stringAt("$.search.type"),
            StringEquals: "pairwise",
          },
        ],
        Next: createProgressChoice("Report prepared pairwise search progress?"),
      },
      {
        And: [
          { Variable: $.stringAt("$.payload[0]"), IsPresent: true },
          { Variable: $.stringAt("$.search"), IsPresent: true },
          {
            Variable: $.stringAt("$.search.type"),
            StringEquals: "indexed",
          },
          {
            Variable: $.stringAt("$.search.functionName"),
            IsPresent: true,
          },
        ],
        Next: createProgressChoice("Report indexed search progress?"),
      },
    ],
    Default: new Pass("No search"),
  })

  return new StateMachine(
    name,
    {
      type: "EXPRESS",
      definition: searchChoice.next(new Pass("Similarity Search Complete")),
      loggingConfiguration: {
        logDestination: $util.interpolate`${logGroup.arn}:*`,
        includeExecutionData: true,
        level: "ALL",
      },
    },
    { deleteBeforeReplace: false }
  )

  function createProgressChoice(choiceName: string) {
    return new Choice(choiceName, {
      Choices: [
        {
          Variable: $.stringAt("$.reportProgress"),
          BooleanEquals: false,
          Next: iterateFeatureSets,
        },
      ],
      Default: setStatusSearching.next(iterateFeatureSets),
    })
  }
}
