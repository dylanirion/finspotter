import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fin Spotter",
    short_name: "Fin Spotter",
    description: "Fin Spotter",
    start_url: "/",
    display: "standalone",
    background_color: "#0070f3",
    theme_color: "#0070f3",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
