import { type ReactNode } from "react"
import { type Metadata } from "next"
import { site } from "@finspotter/config/site"
import { NavigationMenu } from "components/sections/navigation/NavigationMenu"
import { ThemeProvider } from "contexts/Theme"

import "global.css"

import { QueryProvider } from "contexts/Query"

export const metadata: Metadata = {
  //metadataBase: new URL(process.env.BASE_URL),
  title: {
    default: site.title,
    template: `%s - ${site.title}`,
  },
  applicationName: site.title,
  appleWebApp: {
    //https://github.com/vercel/next.js/issues/70272
    title: site.title,
    startupImage: ["/apple-icon"],
  },
  description: site.tagline,
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="text-gray-900 dark:bg-slate-800 dark:text-white">
        <ThemeProvider>
          <QueryProvider>
            <NavigationMenu />
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
