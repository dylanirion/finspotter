export default function devImageLoader({ src }: { src: string }) {
  return encodeURI(`http://localhost:4000/_next/image?src=${src}`)
}
