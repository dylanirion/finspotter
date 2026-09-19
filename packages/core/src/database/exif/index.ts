import { eq, sql } from "drizzle-orm"

import { db } from "../_drizzle"
import { mediaTable } from "../media/sql"
import { exifTable } from "./sql"

export interface ExifData {
  camera_make?: string
  camera_model?: string
  content_type?: string
  date_time?: string
  depth?: string
  height?: string
  width?: string
  length?: string
  temperature?: string
  time_zone?: string
}

const selectFromExif = () =>
  db.select().from(exifTable).$dynamic()

export const jsonExifSubQuery = () =>
  db
    .select({
      json: sql<
        Partial<ExifData>
      >`coalesce(jsonb_object_agg(${exifTable.key}, ${exifTable.value}), '{}'::jsonb)`.as(
        "exifJson"
      ),
    })
    .from(exifTable)
    .where(eq(exifTable.mediaId, mediaTable.id))
    .as("jsonExif")

export const exifCTE = () => db.$with("exif").as(selectFromExif())

export function exifCTEs() {
  const exif = exifCTE()
  const jsonExifCTE = db.$with("jsonExif").as(
    db
      .select({
        mediaId: exif.mediaId,
        json: sql<
          Partial<ExifData>
        >`coalesce(jsonb_object_agg(${exif.key}, ${exif.value}), '{}'::jsonb)`.as(
          "exifJson"
        ),
      })
      .from(exif)
      .groupBy(exif.mediaId)
  )
  const flatExifCTE = db.$with("flat_exif").as(
    db
      .select({
        mediaId: exif.mediaId,
        contentType:
          sql<string | null>`max(${exif.value}) filter (where ${exif.key} = 'content_type')`.as(
            "content_type"
          ),
        length:
          sql<number | null>`max(case when ${exif.key} = 'length' then cast(${exif.value} as integer) end)`.as(
            "length"
          ),
        width:
          sql<number | null>`max(case when ${exif.key} = 'width' then cast(${exif.value} as integer) end)`.as(
            "width"
          ),
        height:
          sql<number | null>`max(case when ${exif.key} = 'height' then cast(${exif.value} as integer) end)`.as(
            "height"
          ),
        dateTime:
          sql<Date | null>`max(case when ${exif.key} = 'date_time' then to_timestamp(${exif.value}, 'YYYY:MM:DD HH24:MI:SS')::timestamp end)`.as(
            "date_time"
          ),
      })
      .from(exif)
      .groupBy(exif.mediaId)
  )
  return { exif, jsonExif: jsonExifCTE, flatExif: flatExifCTE }
}
