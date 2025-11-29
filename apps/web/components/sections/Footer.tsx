import Link from "next/link"
import { mainMenuItems } from "@finspotter/config/site"
import { CapeRADDSecondaryLogo } from "components/ui/logos/CapeRADDSecondaryLogo"

import packageJSON from "../../package.json"

export default function Footer() {
  const currentYear = new Date().getFullYear()
  //Change this to a shaded section with bg similar to SimpleCTA with rounded borders, or maybe just round the bottom part of the copyright section?
  return (
    <footer>
      <div className="relative mx-auto hidden max-w-7xl grid-rows-2 divide-y divide-gray-300 md:grid lg:grid xl:grid 2xl:grid">
        <div className="flex items-center px-8 py-12">
          <div className="w-1/3 shrink-0 justify-items-start">
            <CapeRADDSecondaryLogo className="block w-64" />
          </div>
          <div className="flex w-2/3 shrink-0 justify-between">
            <div className="flex shrink-0">
              <ul>
                {mainMenuItems.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}>
                      <span className="text-base font-light text-gray-600 hover:text-gray-500">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0">
              <span className="text-base font-light text-gray-600 hover:text-gray-500">
                Text
              </span>
            </div>
            <div className="flex shrink-0">
              <span className="text-base font-light text-gray-600 hover:text-gray-500">
                Text
              </span>
            </div>
            <div className="flex shrink-0">
              <span className="text-base font-light text-gray-600 hover:text-gray-500">
                Text
              </span>
            </div>
            <div>
              <ul>
                <li>
                  <Link
                    className="text-base font-light text-gray-600 hover:text-gray-500"
                    href="/policy"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li className="">
                  <span className="text-base font-light text-gray-600 hover:text-gray-500">
                    Text
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex h-16 items-center justify-center rounded-b-lg bg-gray-50">
          <div>
            <div className="text-center text-base font-light text-gray-300">
              © 2020 - {currentYear} Cape RADD, All rights reserved.
            </div>
            <div className="text-center text-base font-light text-gray-300">
              <em>Fin Spotter@{packageJSON.version}</em>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
