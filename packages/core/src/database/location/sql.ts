import {
  customType,
  doublePrecision,
  index,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { Geometry } from "wkx"

import { mediaTable } from "../media/sql"

/** @desc Spatial Reference System ID for WGS84 */
const SRID = 4326

const postgisGeometry = customType<{
  data: GeoJSON.Geometry
  driverData: string
  driverOutput: string | Buffer
}>({
  dataType() {
    return `geometry(Geometry,${SRID})`
  },
  fromDriver(value) {
    if (Buffer.isBuffer(value)) {
      return Geometry.parse(value).toGeoJSON() as GeoJSON.Geometry
    }

    const hex = value.startsWith("\\x") ? value.slice(2) : value
    const geometry =
      hex.length % 2 === 0 && /^[0-9a-f]+$/i.test(hex)
        ? Geometry.parse(Buffer.from(hex, "hex"))
        : Geometry.parse(value)

    return geometry.toGeoJSON() as GeoJSON.Geometry
  },
  toDriver(value) {
    const geometry = Geometry.parseGeoJSON(value)
    geometry.srid = SRID
    return geometry.toEwkt()
  },
})

export const locationsTable = pgTable(
  "locations",
  {
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => mediaTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    geometry: postgisGeometry("geometry"),
    elevation: doublePrecision("elevation"),
    description: varchar("description", { length: 255 }),
  },
  (table) => [
    index("locations_geometry_gist_idx").using("gist", table.geometry),
  ]
)
