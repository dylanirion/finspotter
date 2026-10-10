Fin Spotter is a serverless [Next.js](https://nextjs.org/) project, deployed to AWS with [sst](https://sst.dev) and [pulumi](https://www.pulumi.com/) It is an extensible, modular computer vision, machine learning and identity matching pipeline with pairwise and indexed similarity search, ratio test, and RANSAC refinement. It includes an XState-based annotation interface, managed backend infrastructure (RDS, DynamoDB, Aurora Serverless), and coordinated server-side processing pipelines (Step Functions, Lambda Functions).

## Prerequisites

AWS and Google Cloud accounts are required to deploy the project. A good guide for setting up an AWS account can be found [here](https://sst.dev/docs/aws-accounts/).

Authenticate both the Google Cloud CLI and Application Default Credentials
(ADC). Pulumi uses ADC, and the quota project is required by the API Keys API.

```bash
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project finspotter
pnpm run sso
```

The authenticated Google Cloud account must have permission to enable project
services and create API keys in the `finspotter` project. Grant it **Service
Usage Admin** (`roles/serviceusage.serviceUsageAdmin`) and **API Keys Admin**
(`roles/serviceusage.apiKeysAdmin`), or equivalent permissions. The project
must also have billing enabled. SST/Pulumi enables the API Keys, Maps
JavaScript, and Places APIs and creates the browser-restricted Maps key during
deployment.

A few secrets also need to be set up.

```bash
openssl rand -hex 32 | xargs pnpm sst secret set BETTER_AUTH_SECRET [--stage <stagename>] [--fallback]
pnpm sst secret set SESSender [--stage <stagename>] [--fallback]
# Set this to the Map ID created in Google Maps Platform > Map Management.
pnpm sst secret set MapId [--stage <stagename>] [--fallback]
```

## Database / PostGIS

This project uses Neon Postgres and the `postgis` extension for the `locations`
table. SST enables and verifies the extension automatically after provisioning
the Neon project and before exposing the database connection to dependent
resources.

The location schema is defined in `packages/core/src/database/location/sql.ts`
and uses a PostGIS `geometry(Geometry,4326)` column. It accepts any GeoJSON
geometry, including points, lines, polygons, and multi-geometries, while
enforcing the WGS84 spatial reference system. You can generate or apply
migrations in the usual way:

```bash
cd packages/core
pnpm run drizzle-kit push
```

## Local development

Make sure rustfs has write access for local storage during dev

```bash
chown -R 10001:10001 $(pwd)/.sst/storage/rustfs
```

Start up a development environment:

```bash
pnpm run dev
```

> Note: You only need to perform the following step once per environment

In a separate terminal, create an admin user

```bash
pnpm run create-admin --email your@email.com --name "Your Name" --data '{"firstName": "Your", "lastName": "Name"}'
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
