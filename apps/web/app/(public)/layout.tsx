import { type PropsWithChildren } from "react"
import Footer from "components/sections/Footer"

export default function MainLayout({ children }: PropsWithChildren<object>) {
  return (
    <>
      <main>
        <div className="container mx-auto min-h-screen px-2 pt-20">
          {children}
        </div>
      </main>
      {/* <Footer /> */}
    </>
  )
}
