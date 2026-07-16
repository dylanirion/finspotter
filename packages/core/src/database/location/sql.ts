//TODO: https://orm.drizzle.team/docs/guides/postgis-geometry-point
//https://neon.com/docs/extensions/postgis
//pulumi?
import { sql } from "drizzle-orm"
import { customType, double, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { Geometry } from "wkx"

import { mediaTable } from "../media/sql"

/** @desc Spatial Reference System ID for WGS84 */
const SRID = 4326

/**
 * @desc Defines a `geometry` column type for the ORM, built on MySQL GEOMETRY
 * @see https://dev.mysql.com/doc/refman/8.4/en/gis-point-property-functions.html
 * @see https://github.com/drizzle-team/drizzle-orm/issues/337#issuecomment-2799858963
 */
export const geometry = customType<{
  config: never
  configRequired: false
  data: GeoJSON.Geometry
  driverData: Geometry
}>({
  dataType() {
    return `geometry`
  },

  /** @desc Between driver/db and Typescript */
  fromDriver(value: Geometry) {
    // Convert wkx Geometry to GeoJSON
    return value.toGeoJSON() as GeoJSON.Geometry
  },

  /** @desc Between Typescript and driver/db */
  toDriver(value: GeoJSON.Geometry) {
    const geo = Geometry.parseGeoJSON(value)

    // Build buffer including SRID value
    const srid_buffer = Buffer.alloc(4)
    srid_buffer.writeUInt32LE(SRID, 0)

    // Data buffer is SRID buffer + geometry WKB
    const data_buffer = Buffer.concat([srid_buffer, geo.toWkb()])

    return sql`UNHEX(${data_buffer.toString("hex")})`
  },
})

export const locationsTable = mysqlTable("locations", {
  mediaId: varchar("media_id", { length: 36 })
    .references(() => mediaTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  geometry: geometry("geometry"),
  elevation: double("elevation"),
  description: varchar("description", { length: 255 }),
  //NB: need to manually create spatial index via migration (not supported in Drizzle yet)
})
