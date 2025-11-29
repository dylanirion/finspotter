import { eq, sql, type Subquery, type WithSubquery } from "drizzle-orm"
import { type SubqueryWithSelection } from "drizzle-orm/mysql-core"

import { db, type MaybeAliased } from "../_drizzle"
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

type ExifTable = typeof exifTable
type ExifColumns = MaybeAliased<ExifTable["_"]["columns"]>
type ExifSubquery =
  | Subquery<string, ExifColumns>
  | SubqueryWithSelection<ExifColumns, string>
type ExifCTE = WithSubquery<string, ExifColumns>

const selectFromExif = () =>
  db
    .select({
      mediaId: exifTable.mediaId,
      key: exifTable.key,
      value:
        sql`case when ${exifTable.key} in ('length', 'width', 'height') then cast(${exifTable.value} as unsigned) when ${exifTable.key} = 'date_time' then cast(str_to_date(${exifTable.value}, '%Y:%m:%d %H:%i:%s') as datetime) else ${exifTable.value} end`.as(
          "value"
        ),
    })
    .from(exifTable)
    .$dynamic()

const selectJsonExif = <T extends (ExifSubquery | ExifCTE) & ExifColumns>(
  source: T
) =>
  db
    .select({
      mediaId: source.mediaId,
      json: sql<
        Partial<ExifData>
      >`coalesce(json_objectagg(${source.key}, ${source.value}), json_object())`.as(
        "exifJson"
      ),
    })
    .from(source)
    .$dynamic()

export const exifSubQuery = () =>
  selectFromExif().where(eq(exifTable.mediaId, mediaTable.id)).as("exif")

export const jsonExifSubQuery = () =>
  selectJsonExif(exifSubQuery()).as("jsonExif")

export const exifCTE = () => db.$with("exif").as(selectFromExif())

export function exifCTEs() {
  const exif = exifCTE()
  const jsonExifCTE = db.$with("jsonExif").as(
    selectJsonExif(exif)
      .where(
        sql`${exif.key} in ("content_type", "length", "date_time", "width", "height")`
      )
      .groupBy(exif.mediaId)
  )
  const flatExifCTE = db.$with("flat_exif").as(
    db
      .select({
        mediaId: exif.mediaId,
        contentType:
          sql`max(case when ${exif.key} = 'content_type' then ${exif.value} end)`.as(
            "content_type"
          ),
        length:
          sql`max(case when ${exif.key} = 'length' then cast(${exif.value} as unsigned) end)`.as(
            "length"
          ),
        dateTime:
          sql`max(case when ${exif.key} = 'date_time' then cast(${exif.value} as datetime) end)`.as(
            "date_time"
          ),
      })
      .from(exif)
      .groupBy(exif.mediaId)
  )
  return { exif, jsonExif: jsonExifCTE, flatExif: flatExifCTE }
}
