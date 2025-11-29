import { type NextConfig } from "next"

export default {
  reactStrictMode: true,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
        pathname: "**",
      },
    ],
    ...(process.env.NODE_ENV === "development" && {
      loader: "custom",
      loaderFile: "./lib/devImageLoader.ts",
    }),
    qualities: [75, 100],
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["info", "log", "warn", "error"] } // removes console.debug on production
        : false,
  },
  /*
  webpack: (config, { isServer }) => {
    config.experiments.topLevelAwait = true
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false }
    }
    return config
  },
  */
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: ["jsx-email"],
  //TODO: move this to cloudfront function?
  /*
  async rewrites() {
    return [
      {
        source: "/individuals.jsp",
        has: [
          {
            type: "query",
            key: "number",
          },
        ],
        destination: "/api/redirect/individuals/",
      },
    ]
  },
  */
} satisfies NextConfig
