import { type Metadata } from "next"
import { Fold } from "components/sections/Fold"
import Footer from "components/sections/Footer"
import { SiteLogoError } from "components/ui/logos/SiteLogo"

export const metadata: Metadata = {
  title: "404: This page could not be found",
}

export default function NotFound() {
  return (
    <>
      <main>
        <div className="container mx-auto min-h-screen px-2 pt-20">
          <Fold className="relative flex w-full flex-row items-center justify-center gap-2">
            <SiteLogoError className="block h-64 w-auto" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">404</h2>
              <p>This page could not be found.</p>
            </div>
          </Fold>
        </div>
      </main>
      {/* <Footer /> */}
    </>
  )
}
