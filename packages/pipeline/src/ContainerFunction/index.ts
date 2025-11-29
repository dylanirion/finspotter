export type ContainerFunctionArgs = Partial<
  Omit<aws.lambda.FunctionArgs, "name" | "imageUri" | "packagType" | "role" | "code">
> & {
  context: dockerbuild.ImageArgs["context"]
  role?: aws.iam.Role
  transform?: {
    function?: Transform<aws.lambda.FunctionArgs>
    repository?: Transform<aws.ecr.RepositoryArgs>
    lifecycle?: Transform<aws.ecr.LifecyclePolicyArgs>
    image?: Transform<Omit<dockerbuild.ImageArgs, "context">>
    logGroup?: Transform<aws.cloudwatch.LogGroupArgs>
    role?: Transform<aws.iam.RoleArgs>
  }
}

export class ContainerFunction extends $util.ComponentResource {
  private role: $util.Output<aws.iam.Role>
  private logGroup: $util.Output<aws.cloudwatch.LogGroup>
  private function: $util.Output<aws.lambda.Function>

  constructor(
    name: string,
    args: ContainerFunctionArgs,
    opts?: $util.ComponentResourceOptions
  ) {
    super("finspotter:pipeline:ContainerFunction", name, args, opts)
    const parent = this

    const ecrRepository = new aws.ecr.Repository(
      ...transform(
        args.transform?.repository,
        `ContainerImages${name}`,
        {
          name: `${$app.name}-${$app.stage}-containerimages/${name.toLowerCase()}`,
        },
        { parent }
      )
    )

    new aws.ecr.LifecyclePolicy(
      ...transform(
        args.transform?.lifecycle,
        `ContainerImages${name}Lifecycle`,
        {
          repository: ecrRepository.name,
          policy: `{
    "rules": [
        {
            "rulePriority": 1,
            "description": "Expire untagged images older than 14 days",
            "selection": {
                "tagStatus": "untagged",
                "countType": "sinceImagePushed",
                "countUnit": "days",
                "countNumber": 14
            },
            "action": {
                "type": "expire"
            }
        }
    ]
  }`,
        },
        { parent }
      )
    )

    const authToken = aws.ecr.getAuthorizationTokenOutput({
      registryId: ecrRepository.registryId,
    })

    const image = new dockerbuild.Image(
      ...transform<dockerbuild.ImageArgs>(
        args.transform?.image,
        `${name}Image`,
        {
          tags: [$util.interpolate`${ecrRepository.repositoryUrl}:latest`],
          context: args.context,
          cacheFrom: [
            {
              registry: {
                ref: $util.interpolate`${ecrRepository.repositoryUrl}:latest`,
              },
            },
          ],
          cacheTo: [
            {
              inline: {},
            },
          ],
          platforms: ["linux/amd64"],
          push: true,
          registries: [
            {
              address: ecrRepository.repositoryUrl,
              username: authToken.userName,
              password: authToken.password,
            },
          ],
        },
        { parent }
      )
    )

    const logGroup = new aws.cloudwatch.LogGroup(
      ...transform(
        args.transform?.logGroup,
        `${name}LogGroup`,
        {
          name: `/aws/lambda/${$app.name}-${$app.stage}-${name.toLowerCase()}`,
          retentionInDays: 3,
        },
        { parent }
      )
    )

    this.logGroup = $util.output(logGroup)

    const role = !args.role
      ? new aws.iam.Role(
          ...transform(
            args.transform?.role,
            `${name}Role`,
            {
              name: `${$app.name}-${$app.stage}-${name}Role`,
              assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: "lambda.amazonaws.com",
              }),
              managedPolicyArns: [
                "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
              ],
            },
            { parent }
          )
        )
      : aws.iam.Role.get(
          `${name}Role`,
          $util.output(args.role.arn).apply((arn) => arn.split("/")[1]),
          {},
          { parent }
        )

    this.role = $util.output(role)

    const { architectures, memorySize, timeout, role: _role, ...rest } = args

    const fn = new aws.lambda.Function(
      ...transform(
        args.transform?.function,
        `${name}Function`,
        {
          name: `${$app.name}-${$app.stage}-${name}Function`,
          imageUri: image.ref.apply((ref) => ref?.replace(":latest", "")),
          packageType: "Image",
          architectures: architectures ?? ["x86_64"],
          memorySize: memorySize ?? 1024,
          timeout: timeout ?? 90,
          role: role.arn,
          loggingConfig: {
            logGroup: logGroup.name,
            logFormat: "Text",
          },
          ...rest,
        },
        { parent }
      )
    )

    this.function = $util.output(fn)
  }

  /**
   * The name of the Lambda function.
   */
  public get name() {
    return this.function.name
  }

  /**
   * The ARN of the Lambda function.
   */
  public get arn() {
    return this.function.arn
  }

  /**
   * The underlying [resources](/docs/components/#nodes) this component creates.
   */
  public get nodes() {
    return {
      /**
       * The IAM Role the function will use.
       */
      role: this.role,
      /**
       * The AWS Lambda function.
       */
      function: this.function,
      /**
       * The CloudWatch Log Group the function logs are stored.
       */
      logGroup: this.logGroup,
    }
  }
}

export type Transform<T> =
  | Partial<T>
  | ((args: T, opts: $util.CustomResourceOptions, name: string) => undefined)

export function transform<T extends object>(
  transform: Transform<T> | undefined,
  name: string,
  args: T,
  opts: $util.CustomResourceOptions
) {
  // Case: transform is a function
  if (typeof transform === "function") {
    transform(args, opts, name)
    return [name, args, opts] as const
  }

  // Case: no transform
  // Case: transform is an argument
  return [name, { ...args, ...transform }, opts] as const
}
