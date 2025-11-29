//TODO query and manage all config from a database?

export const ALLOWEDCONTENTTYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic", //TODO: "application/octet-stream"
  "image/webp",
  "video/mp4",
  "video/quicktime",
]

export const site = {
  title: "Fin Spotter",
  tagline: "Join the Quest, Shark Science for Everyone",
  primaryLogo: {
    src: "https://static.caperadd.com/wp-content/uploads/20200522132043/primary_trans.png",
  },
  secondaryLogo: {
    src: "https://static.caperadd.com/wp-content/uploads/20200518135336/CapeRADD_secondary_small-3.png",
  },
}

export const mainMenuItems = [
  { label: "Submit", href: "/submit" },
  { label: "About", href: "/about" },
  { label: "Individuals", href: "/individuals" },
  { label: "Adopt a Shark!", href: "/adopt" },
]

export const userMenuItems = [
  { label: "Your Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
]
