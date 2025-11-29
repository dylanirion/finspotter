/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "exifr/dist/lite.esm.mjs" {
  interface Tags {
    [name: string]: string | number | number[] | Uint8Array
  }

  type Input =
    | ArrayBuffer
    | SharedArrayBuffer
    | Buffer
    | Uint8Array
    | DataView
    | string
    | Blob
    | File
    | HTMLImageElement

  type Filter = (string | number)[]

  interface GpsOutput {
    latitude: number
    longitude: number
  }

  interface FormatOptions {
    skip?: Filter
    pick?: Filter
    translateKeys?: boolean
    translateValues?: boolean
    reviveValues?: boolean
    parse?: boolean // XMP only
    multiSegment?: boolean // XMP and icc only
  }

  interface Options extends FormatOptions {
    // TIFF segment IFD blocks
    tiff?: FormatOptions | boolean
    ifd0?: FormatOptions // cannot be disabled.
    ifd1?: FormatOptions | boolean
    exif?: FormatOptions | boolean
    gps?: FormatOptions | boolean
    interop?: FormatOptions | boolean
    // notable properties in TIFF
    makerNote?: boolean
    userComment?: boolean
    // Other segments
    xmp?: FormatOptions | boolean
    icc?: FormatOptions | boolean
    iptc?: FormatOptions | boolean
    // JPEG only segment
    jfif?: FormatOptions | boolean
    // PNG only only segment
    ihdr?: FormatOptions | boolean
    // other options
    sanitize?: boolean
    mergeOutput?: boolean
    firstChunkSize?: number
    chunkSize?: number
    chunkLimit?: number
  }

  interface IRotation {
    deg: number
    rad: number
    scaleX: number
    scaleY: number
    dimensionSwapped: boolean
    css: boolean
    canvas: boolean
  }

  function parse(
    data: Input,
    options?: Options | Filter | boolean
  ): Promise<any>
  function gps(data: Input): Promise<GpsOutput>
  function orientation(data: Input): Promise<number | undefined>
  function rotation(data: Input): Promise<IRotation | undefined>
  function thumbnail(data: Input): Promise<Uint8Array | Buffer | undefined>
  function thumbnailUrl(data: Input): Promise<string | undefined>
  function sidecar(
    data: Input,
    options?: Options,
    type?: string
  ): Promise<object | undefined>

  const rotations: { [index: number]: IRotation }
  const rotateCanvas: boolean
  const rotateCss: boolean

  const tagKeys: Map<string, Map<number, string>>
  const tagValues: Map<string, Map<number, any>>
  const tagRevivers: Map<string, Map<number, any>>

  const fileParsers: Map<string, any>
  const segmentParsers: Map<string, any>
  const fileReaders: Map<string, any>

  class Exifr {
    constructor(options?: Options)
    read(data: Input): Promise<void>
    parse(): Promise<any>
    extractThumbnail(): Promise<Uint8Array | undefined>
  }

  type parse = typeof parse
  type gps = typeof gps
  type orientation = typeof orientation
  type rotation = typeof rotation
  type thumbnail = typeof thumbnail
  type thumbnailUrl = typeof thumbnailUrl
  type sidecar = typeof sidecar

  type rotations = typeof rotations
  type rotateCanvas = typeof rotateCanvas
  type rotateCss = typeof rotateCss

  type tagKeys = typeof tagKeys
  type tagValues = typeof tagValues
  type tagRevivers = typeof tagRevivers

  type fileParsers = typeof fileParsers
  type segmentParsers = typeof segmentParsers
  type fileReaders = typeof fileReaders
}
