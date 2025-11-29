import {
  type FC,
  type PropsWithoutRef,
  type RefAttributes,
  type SVGProps,
} from "react"

type IconSVGProps = PropsWithoutRef<SVGProps<SVGSVGElement>> &
  RefAttributes<SVGSVGElement>
type IconProps = IconSVGProps & {
  title?: string
  titleId?: string
}

interface Props {
  className: string
  section: string
  heading: string
  description: string
  features: Array<{
    name: string
    description: string
    icon: FC<IconProps>
  }>
}

export function Feature2x2({
  className,
  section,
  heading,
  description,
  features,
}: Props) {
  return (
    <div className={className}>
      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <h2 className="text-lg font-semibold text-indigo-600">{section}</h2>
          <p className="mt-2 text-3xl leading-8 font-bold tracking-tight sm:text-4xl">
            {heading}
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
            {description}
          </p>
        </div>

        <div className="mt-10">
          <dl className="space-y-10 md:grid md:grid-cols-2 md:space-y-0 md:gap-x-8 md:gap-y-10">
            {features.map((feature) => (
              <div key={feature.name} className="relative">
                <dt>
                  <div className="absolute flex size-12 items-center justify-center rounded-md bg-indigo-500 text-white">
                    <feature.icon className="size-6" aria-hidden="true" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium">
                    {feature.name}
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  {feature.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
