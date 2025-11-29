import Link from "next/link"
import { site } from "@finspotter/config/site"
import {
  BoltIcon,
  ChatBubbleBottomCenterTextIcon,
  GlobeAltIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline"
import { Feature2x2 } from "components/sections/Feature2x2"
import { Fold } from "components/sections/Fold"
import { HeroAngledImage } from "components/sections/HeroAngledImage"
import { SimpleCTA } from "components/sections/SimpleCTA"
import { Button } from "components/ui/inputs/Button"

export default function IndexPage() {
  return (
    <>
      <Fold className="relative flex w-full flex-col justify-between">
        <HeroAngledImage
          className="mb-4 shrink-0"
          src="/static/hero.webp"
          alt="A group of SCUBA divers photographing a shark"
        >
          <div className="text-center lg:pl-8 lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight lg:text-6xl">
              <span className="block">{site.tagline.split(",")[0]}</span>{" "}
              <span className="block text-indigo-600">
                {site.tagline.split(",")[1]}
              </span>
            </h1>
            <p className="mt-3 text-base text-gray-500 sm:mx-auto sm:mt-5 sm:max-w-xl sm:text-lg md:mt-5 md:text-xl lg:mx-0 lg:text-2xl">
              Fin Spotter is a database of shark encounters powered by{" "}
              <span className="font-bold text-violet-600">AI🤖</span> and{" "}
              <span className="font-bold text-violet-600">
                Citizen Science👐
              </span>
              . Get involved by submitting your photos!
            </p>
            <div className="mt-8 flex flex-row justify-center lg:mt-5 lg:flex-col lg:justify-start">
              <Link href="/submit">
                <Button
                  intent="primary"
                  size="large"
                  className="flex cursor-pointer items-center justify-center"
                >
                  Submit your photos
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  intent="secondary"
                  size="large"
                  className="ml-3 flex cursor-pointer items-center justify-center lg:mt-3 lg:ml-0"
                >
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </HeroAngledImage>
        <SimpleCTA
          className="my-auto shrink-0"
          title="Ready to dive in?"
          subtitle="Join us on a guided snorkel or adopt a shark"
        >
          <a
            href="https://www.caperadd.com/shop/snorkel-for-science/"
            target="_blank"
          >
            <Button
              className="inline-flex cursor-pointer items-center justify-center"
              intent="primary"
              size="large"
            >
              <span className="pr-2 text-3xl">🤿</span> Book now
            </Button>
          </a>
          <Link href="/adopt">
            <Button
              className="inline-flex cursor-pointer items-center justify-center rounded-md border font-bold"
              intent="none"
              size="large"
            >
              <span className="pr-2 text-3xl">🦈</span> Adopt a shark!
            </Button>
          </Link>
        </SimpleCTA>
      </Fold>
      <Feature2x2
        className="mb-16 bg-white dark:bg-slate-800"
        section="⚡Powered By You 🫵"
        heading="This section will highlight latest/most sightings, adoptions, Top Spotters, etc"
        description="Does it actually need a description?"
        features={[
          {
            name: "Competitive exchange rates",
            description:
              "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.",
            icon: GlobeAltIcon,
          },
          {
            name: "No hidden fees",
            description:
              "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.",
            icon: ScaleIcon,
          },
          {
            name: "Transfers are instant",
            description:
              "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.",
            icon: BoltIcon,
          },
          {
            name: "Mobile notifications",
            description:
              "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.",
            icon: ChatBubbleBottomCenterTextIcon,
          },
        ]}
      />
    </>
  )
}
