import { sql } from "drizzle-orm"
import {
  AnySQLiteColumn,
  integer,
  numeric,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const metaDataTable = sqliteTable(
  "metadata",
  {
    metadataRowid: integer("metadata_rowid").primaryKey(),
    metadataKey: text("metadata_key"),
    metadataValue: text("metadata_value"),
  },
  (table) => {
    return {
      sqliteAutoindexMetadata1: uniqueIndex("sqlite_autoindex_metadata_1").on(
        table.metadataKey
      ),
    }
  }
)

export const configTable = sqliteTable(
  "config",
  {
    configRowid: integer("config_rowid").primaryKey(),
    configHashid: text("config_hashid"),
    configTablename: text("config_tablename"),
    configStrid: text("config_strid"),
    configDict: numeric("config_dict"),
  },
  (table) => {
    return {
      sqliteAutoindexConfig1: uniqueIndex("sqlite_autoindex_config_1").on(
        table.configHashid
      ),
    }
  }
)

export const featuresTable = sqliteTable(
  "features",
  {
    featuresRowid: integer("features_rowid").primaryKey(),
    imagesRowid: integer("images_rowid").notNull(),
    configRowid: integer("config_rowid").default(0),
    vector: numeric("vector"),
  },
  (table) => {
    return {
      sqliteAutoindexFeatures1: uniqueIndex("sqlite_autoindex_features_1").on(
        table.imagesRowid,
        table.configRowid
      ),
    }
  }
)

export const localizationsFeaturesTable = sqliteTable(
  "localizations_features",
  {
    localizationsFeaturesRowid: integer(
      "localizations_features_rowid"
    ).primaryKey(),
    localizationsRowid: integer("localizations_rowid").notNull(),
    configRowid: integer("config_rowid").default(0),
    vector: numeric("vector"),
  },
  (table) => {
    return {
      sqliteAutoindexLocalizationsFeatures1: uniqueIndex(
        "sqlite_autoindex_localizations_features_1"
      ).on(table.localizationsRowid, table.configRowid),
    }
  }
)

export const featTable = sqliteTable(
  "feat",
  {
    featRowid: integer("feat_rowid").primaryKey(),
    chipsRowid: integer("chips_rowid").notNull(),
    configRowid: integer("config_rowid").default(0),
    numFeats: integer("num_feats"),
    kpts: numeric("kpts"),
    vecs: numeric("vecs"),
  },
  (table) => {
    return {
      sqliteAutoindexFeat1: uniqueIndex("sqlite_autoindex_feat_1").on(
        table.chipsRowid,
        table.configRowid
      ),
    }
  }
)

export const featWeightTable = sqliteTable(
  "featweight",
  {
    featweightRowid: integer("featweight_rowid").primaryKey(),
    featRowid: integer("feat_rowid").notNull(),
    probchipRowid: integer("probchip_rowid").notNull(),
    configRowid: integer("config_rowid").default(0),
    fwg: numeric("fwg"),
  },
  (table) => {
    return {
      sqliteAutoindexFeatweight1: uniqueIndex(
        "sqlite_autoindex_featweight_1"
      ).on(table.featRowid, table.probchipRowid, table.configRowid),
    }
  }
)
