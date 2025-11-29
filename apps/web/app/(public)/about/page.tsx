import { type Metadata } from "next"
import { CarouselApiProvider } from "components/ui/carousel/Carousel"
import { CaptchaProvider } from "contexts/Captcha"
import { Toaster } from "react-hot-toast"

import { About } from "./About"

export const metadata: Metadata = {
  title: "About",
}

export default function AboutPage() {
  return (
    <>
      <CaptchaProvider>
        <CarouselApiProvider>
          <About />
        </CarouselApiProvider>
      </CaptchaProvider>
      <Toaster position="bottom-right" />
    </>
  )
}
