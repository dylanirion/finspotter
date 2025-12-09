Fin Spotter is a (mostly) serverless [Next.js](https://nextjs.org/) project, deployed to AWS with [sst](https://sst.dev) It is an extensible, modular computer vision, machine learning and identity matching pipeline with pairwise and indexed similarity search, ratio test, and RANSAC refinement. It includes an XState-based annotation interface, managed backend infrastructure (RDS, DynamoDB, Aurora Serverless), and coordinated server-side processing pipelines (Step Functions, Lambda Functions).

## Prerequisites
```bash
gcloud auth login
```

Despite being (mostly) serverless, there are still some prerequisites. Namely, a database, and an email server. `./infra/database.ts` references a pre-exisitng RDS database instance, and `./infra/email.ts` a pre-existing SMTP server. Set up the necessary Secrets to connect, or optionally modify `./infra/database.ts` and `./infra/email.ts` to provision a new database and email service for your project.

- TODO: add commented/conditional provisioning example to `./infra/database.ts` with notes about modifying drizzle connections.
- TODO: add commented/conditional SES example to `./infra/email.ts` (Does this change anything in package/email?)
- TODO: required AWS environment

```bash
npx sst secret set RDS_DB_IDENTIFIER '<example-rds-identifier>' [--stage <stagename>] [--fallback]
npx sst secret set DB_DATABASE '<example database>' [--stage <stagename>] [--fallback]
npx sst secret set DB_USER '<example username>' [--stage <stagename>] [--fallback]
npx sst secret set DB_PASSWORD '<example password>' [--stage <stagename>] [--fallback]
npx sst secret set EMAIL_HOST 'host.example.com' [--stage <stagename>] [--fallback]
npx sst secret set EMAIL_PORT '465' [--stage <stagename>] [--fallback]
npx sst secret set EMAIL_USER 'user@example.com' [--stage <stagename>] [--fallback]
npx sst secret set EMAIL_PASSWORD '<example password>' [--stage <stagename>] [--fallback]
npx sst secret set EMAIL_FROM '<Example Name>' [--stage <stagename>] [--fallback]
npx sst secret set EMAIL_NOREPLY 'noreply@example.com' [--stage <stagename>] [--fallback]
openssl rand -hex 32 | xargs npx sst secret set BETTER_AUTH_SECRET [--stage <stagename>] [--fallback]
npx sst secret set GOOGLE_MAPS_API_KEY '<example api key>' [--stage <stagename>] [--fallback]
npx sst secret set GOOGLE_MAPS_API_MAPID '<example_map_id>' [--stage <stagename>] [--fallback]
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