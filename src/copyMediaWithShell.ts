import { spawn } from "child_process"
import { parseArgs } from "util"

//example usage: pnpm run copy-media [--stage prod] -s <bucket_name> --prefix "_assets" -p "^wb\/[^\/]+\/[^\/]+\/" -r "images/"
//TODO: rewrite/sanitise basename, maybe to id?

const options = {
  stage: {
    type: "string",
  },
  source: {
    type: "string",
    short: "s",
  },
  prefix: {
    type: "string",
  },
  pattern: {
    type: "string",
    short: "p",
  },
  replace: {
    type: "string",
    short: "r",
  },
} as const
const { values: args } = parseArgs({
  args: process.argv,
  options,
  allowPositionals: true,
})

const { stage, ...restArgs } = args

const scriptArgs = Object.entries(restArgs).flatMap(([key, value]) => {
  if (value === undefined) return [] // skip undefined
  const flag = key.length === 1 ? `-${key}` : `--${key}`
  return [flag, String(value)]
})

const sstArgs = stage ? ["--stage", stage] : []

const child = spawn(
  "sst",
  [
    "shell",
    ...sstArgs,
    "--",
    "tsx",
    "src/copyMediaToNewBucket.ts",
    ...scriptArgs,
  ],
  { stdio: "inherit" }
)

child.on("close", (code) => {
  process.exit(code)
})
