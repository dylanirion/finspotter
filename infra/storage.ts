import { domain } from "./domain"

//TODO: this doesn't load on first run
new sst.x.DevCommand("RustFS", {
  environment: {
    RUSTFS_ACCESS_KEY: process.env.RUSTFS_ACCESS_KEY,
    RUSTFS_SECRET_KEY: process.env.RUSTFS_SECRET_KEY,
  },
  dev: {
    autostart: true,
    command: `docker run \
      --rm \
      -p 9000:9000 \
      -p 9001:9001 \
      -v ${process.cwd()}/.sst/storage/rustfs:/data \
      -e RUSTFS_ACCESS_KEY \
      -e RUSTFS_SECRET_KEY \
      -e RUSTFS_ADDRESS=":9000" \
      -e RUSTFS_CORS_ALLOWED_ORIGINS="http://localhost:3000" \
      -e RUSTFS_OBS_LOG_STDOUT_ENABLED=true \
      rustfs/rustfs:latest`,
  },
})

//TODO: SSL only
export const bucket = new sst.aws.Bucket(
  "Uploads",
  {
    enforceHttps: !$dev,
    cors: {
      allowHeaders: ["*"],
      allowMethods: ["POST", "PUT", "GET", "HEAD", "DELETE"],
      allowOrigins: [$dev ? `http://${domain}` : `https://${domain}`],
      exposeHeaders: [],
      maxAge: "0 seconds",
    },
    ...(!$dev
      ? {
          lifecycle: [
            {
              prefix: "temp/daily/",
              expiresIn: "1 day",
            },
          ],
        }
      : { access: "public" }),
  },
  $dev
    ? {
        provider: new aws.Provider("rustfs", {
          endpoints: [{ s3: "http://localhost:9000" }],
          accessKey: process.env.RUSTFS_ACCESS_KEY,
          secretKey: process.env.RUSTFS_SECRET_KEY,
          skipCredentialsValidation: true,
          skipMetadataApiCheck: true,
          skipRequestingAccountId: true,
          s3UsePathStyle: true,
        }),
      }
    : undefined
)
