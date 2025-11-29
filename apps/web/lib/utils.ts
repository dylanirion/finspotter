import { type Blob } from "buffer"
import { createHash } from "crypto"
import { type Readable } from "stream"
import { clsx, type ClassValue } from "clsx"
import { customRandom, urlAlphabet } from "nanoid"
import { twMerge } from "tailwind-merge"

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

//TODO: how to better achieve this?
export const twCols = [
  {
    hex: "#3b82f6",
    tw: "blue-500",
    text: "text-blue-500",
    bgChecked: "data-checked:bg-blue-500",
  },
  {
    hex: "#7c3aed",
    tw: "violet-600",
    text: "text-violet-600",
    bgChecked: "data-checked:bg-violet-600",
  },
  {
    hex: "#f43f5e",
    tw: "rose-500",
    text: "text-rose-500",
    bgChecked: "data-checked:bg-rose-500",
  },
  {
    hex: "#ea580c",
    tw: "orange-600",
    text: "text-orange-600",
    bgChecked: "data-checked:bg-orange-600",
  },
  {
    hex: "#fbbf24",
    tw: "amber-400",
    text: "text-amber-400",
    bgChecked: "data-checked:bg-amber-400",
  },
]

// Pixel GIF code adapted from https://stackoverflow.com/a/33919020/266535
// https://github.com/vercel/next.js/blob/canary/examples/image-component/pages/color.tsx
export function rgbDataURL(r: number, g: number, b: number) {
  const keyStr =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

  const triplet = (e1: number, e2: number, e3: number) =>
    keyStr.charAt(e1 >> 2) +
    keyStr.charAt(((e1 & 3) << 4) | (e2 >> 4)) +
    keyStr.charAt(((e2 & 15) << 2) | (e3 >> 6)) +
    keyStr.charAt(e3 & 63)

  return `data:image/gif;base64,R0lGODlhAQABAPAA${
    triplet(0, r, g) + triplet(b, 255, 255)
  }/yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==`
}

//TODO: accept styling as argument
export function countObjectToSentence(obj: Record<string, number>) {
  const numbers = [
    "zero",
    "one", // "a" would be nicer, but need to handle "an"
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ]
  const keys = Object.keys(obj)
  const counts = Object.values(obj)
  const lastKey = keys.pop()
  const lastCount = counts.pop()
  return (
    [
      counts.map((i) =>
        i <= 10 ? numbers[i] : "more than " + numbers[numbers.length]
      ),
      Array.from(" ".repeat(keys.length)),
      Array.from('<span className="text-indigo-600">'.repeat(keys.length)),
      keys,
      Array.from("</span>".repeat(keys.length)),
      counts.map((i) => (i > 1 ? "s" : "")),
    ]
      .reduce<string[][]>(
        (a, b) =>
          a.map((v, i) => {
            const arr: Array<string> = []
            return arr.concat(v, b[i])
          }),
        []
      )
      .map((a) => a.join(""))
      .join(", ") +
    `${keys.length ? " and" : ""} ${numbers[Number(lastCount)]} <span className="text-indigo-600">${lastKey}${lastCount! > 1 ? "s" : ""}</span>!`
  )
}

export function parseDate(string: string) {
  const parts = string.split(/\D/)
  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5])
  )
}

export function splitBy<T>(
  arr: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const pass: T[] = []
  const fail: T[] = []
  for (const el of arr) {
    predicate(el) ? pass.push(el) : fail.push(el)
  }
  return [pass, fail]
}

export const shortDateFormat: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
}

// https://stackoverflow.com/a/14919494
export function humanReadableBytes(
  bytes: number,
  si: boolean = false,
  dp: number = 1
) {
  const thresh = si ? 1000 : 1024

  if (Math.abs(bytes) < thresh) {
    return bytes + " B"
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
  let u = -1
  const r = 10 ** dp

  do {
    bytes /= thresh
    ++u
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  )

  return bytes.toFixed(dp) + " " + units[u]
}

export async function nano(file: File | Response | Blob) {
  const hash = await file
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer))
    .then((array) => createHash("sha256").update(array).digest())
  return customRandom(urlAlphabet, 19, () => new Uint8Array(hash))()
}

export async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.on("data", (chunk) => chunks.push(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
  })
}
