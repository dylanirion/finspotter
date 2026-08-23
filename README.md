Fin Spotter is a serverless [Next.js](https://nextjs.org/) project, deployed to AWS with [sst](https://sst.dev) and [pulumi](https://www.pulumi.com/) It is an extensible, modular computer vision, machine learning and identity matching pipeline with pairwise and indexed similarity search, ratio test, and RANSAC refinement. It includes an XState-based annotation interface, managed backend infrastructure (RDS, DynamoDB, Aurora Serverless), and coordinated server-side processing pipelines (Step Functions, Lambda Functions).

## Prerequisites
AWS and Google Cloud accounts are required to deploy the project. A good guide for setting up an AWS account can be found [here](https://sst.dev/docs/aws-accounts/).

```bash
gcloud auth login
pnpm run sso
```

A few secrets also need to be set up.

```bash
openssl rand -hex 32 | xargs npx sst secret set BETTER_AUTH_SECRET [--stage <stagename>] [--fallback]
npx sst secret set SESSender [--stage <stagename>] [--fallback]
```

## Local development

First, start up a development environment:

```bash
pnpm run dev
```

Then open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Structure

```bash
├── apps
│   └── web
│       └── Next.js frontend application
├── extensions
│   ├── annotations
│   │   ├── bbox_xywh
│   │   │   └── Contains...
│   │   ├── bbox_xywha
│   │   │   └── Contains...
│   │   ├── bbox_xywha_segmentation
│   │   │   └── Contains...
│   │   └── segmentation
│   │       └── Contains...
│   └── pipeline
│       ├── hesaff
│       │   └── Contains...
│       └── yolact
│           └── Contains...
├── infra
│   └── Cloud infrastructure
├── packages
│   ├── annotations
│   │   └── Contains ...
│   ├── canvas
│   │   └── Contains ...
│   ├── config
│   │   └── Contains ...
│   ├── core
│   │   └── Contains ...
│   ├── email
│   │   └── Contains ...
│   └── pipeline
│       └── Contains ...
└── sst.config.ts
```

## drizzle-kit

`drizzle-kit` needs some of the resources linked from `sst`. The `drizzle-kit` script defined in `@finspotter/core/package.json` wraps the normal drizzle-kit command in `sst shell`. Example usage:

```bash
cd packages/core
pnpm run drizzle-kit studio
```

## emails
Preview email templates
```bash
cd packages/email
pnpm run preview
```

## Extending

### Annotation Formats
Add additional CV/ML algorithms by providing a workspace or node module with the following exports
```javascript
{
  name: string,
  pkg: string,
  detect: sst.aws.Function | aws.Function
}
```

### Pipeline
Add additional CV/ML algorithms by providing a workspace or node module that exports

https://github.com/ducha-aiki/hesaff-pytorch

### TODO:
migration will need to copy unapproved to dynamo
send existing users a link to create an account