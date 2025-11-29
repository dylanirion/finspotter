import { relations, sql } from "drizzle-orm"
import {
  blob,
  index,
  integer,
  numeric,
  real,
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

export const keysTable = sqliteTable(
  "keys",
  {
    lbltypeRowid: integer("lbltype_rowid").primaryKey(),
    lbltypeText: text("lbltype_text").notNull(),
    lbltypeDefault: text("lbltype_default").notNull(),
  },
  (table) => {
    return {
      sqliteAutoindexKeys1: uniqueIndex("sqlite_autoindex_keys_1").on(
        table.lbltypeText
      ),
    }
  }
)

export const lblImageTable = sqliteTable(
  "lblimage",
  {
    lblimageRowid: integer("lblimage_rowid").primaryKey(),
    lblimageUuid: numeric("lblimage_uuid").notNull(),
    lbltypeRowid: integer("lbltype_rowid").notNull(),
    lblimageValue: text("lblimage_value").notNull(),
    lblimageNote: text("lblimage_note"),
  },
  (table) => {
    return {
      sqliteAutoindexLblimage1: uniqueIndex("sqlite_autoindex_lblimage_1").on(
        table.lbltypeRowid,
        table.lblimageValue
      ),
    }
  }
)

export const lblAnnotTable = sqliteTable(
  "lblannot",
  {
    lblannotRowid: integer("lblannot_rowid").primaryKey(),
    lblannotUuid: numeric("lblannot_uuid").notNull(),
    lbltypeRowid: integer("lbltype_rowid").notNull(),
    lblannotValue: text("lblannot_value").notNull(),
    lblannotNote: text("lblannot_note"),
  },
  (table) => {
    return {
      sqliteAutoindexLblannot1: uniqueIndex("sqlite_autoindex_lblannot_1").on(
        table.lbltypeRowid,
        table.lblannotValue
      ),
    }
  }
)

export const contributorsTable = sqliteTable(
  "contributors",
  {
    contributorRowid: integer("contributor_rowid").primaryKey(),
    contributorUuid: numeric("contributor_uuid").notNull(),
    contributorTag: text("contributor_tag"),
    contributorNameFirst: text("contributor_name_first"),
    contributorNameLast: text("contributor_name_last"),
    contributorLocationCity: text("contributor_location_city"),
    contributorLocationState: text("contributor_location_state"),
    contributorLocationCountry: text("contributor_location_country"),
    contributorLocationZip: text("contributor_location_zip"),
    contributorNote: text("contributor_note"),
  },
  (table) => {
    return {
      sqliteAutoindexContributors1: uniqueIndex(
        "sqlite_autoindex_contributors_1"
      ).on(table.contributorTag),
    }
  }
)

export const partyTable = sqliteTable(
  "party",
  {
    partyRowid: integer("party_rowid").primaryKey(),
    partyTag: text("party_tag").notNull(),
  },
  (table) => {
    return {
      sqliteAutoindexParty1: uniqueIndex("sqlite_autoindex_party_1").on(
        table.partyTag
      ),
    }
  }
)

export const annotGroupsTable = sqliteTable(
  "annotgroups",
  {
    annotgroupRowid: integer("annotgroup_rowid").primaryKey(),
    annotgroupUuid: numeric("annotgroup_uuid").notNull(),
    annotgroupText: text("annotgroup_text").notNull(),
    annotgroupNote: text("annotgroup_note").notNull(),
  },
  (table) => {
    return {
      sqliteAutoindexAnnotgroups1: uniqueIndex(
        "sqlite_autoindex_annotgroups_1"
      ).on(table.annotgroupText),
    }
  }
)

export const annotgroupAnnotationRelationshipTable = sqliteTable(
  "annotgroup_annotation_relationship",
  {
    garRowid: integer("gar_rowid").primaryKey(),
    annotgroupRowid: integer("annotgroup_rowid").notNull(),
    annotRowid: integer("annot_rowid"),
  },
  (table) => {
    return {
      sqliteAutoindexAnnotgroupAnnotationRelationship1: uniqueIndex(
        "sqlite_autoindex_annotgroup_annotation_relationship_1"
      ).on(table.annotgroupRowid, table.annotRowid),
    }
  }
)

export const speciesTable = sqliteTable(
  "species",
  {
    speciesRowid: integer("species_rowid").primaryKey(),
    speciesUuid: numeric("species_uuid").notNull(),
    speciesText: text("species_text").notNull(),
    speciesNice: text("species_nice").notNull(),
    speciesCode: text("species_code").notNull(),
    speciesNote: text("species_note"),
    speciesToggleEnabled: integer("species_toggle_enabled").default(1),
  },
  (table) => {
    return {
      sqliteAutoindexSpecies1: uniqueIndex("sqlite_autoindex_species_1").on(
        table.speciesText
      ),
    }
  }
)

export const imagesetImageRelationshipTable = sqliteTable(
  "imageset_image_relationship",
  {
    gsgrRowid: integer("gsgr_rowid").primaryKey(),
    imageRowid: integer("image_rowid").notNull(),
    imagesetRowid: integer("imageset_rowid"),
  },
  (table) => {
    return {
      gidsToGs: index("gids_to_gs").on(table.imagesetRowid),
      gsToGids: index("gs_to_gids").on(table.imageRowid),
      sqliteAutoindexImagesetImageRelationship1: uniqueIndex(
        "sqlite_autoindex_imageset_image_relationship_1"
      ).on(table.imageRowid, table.imagesetRowid),
    }
  }
)

export const imageLblimageRelationshipTable = sqliteTable(
  "image_lblimage_relationship",
  {
    glrRowid: integer("glr_rowid").primaryKey(),
    imageRowid: integer("image_rowid").notNull(),
    lblimageRowid: integer("lblimage_rowid").notNull(),
    glrConfidence: real("glr_confidence"),
  },
  (table) => {
    return {
      sqliteAutoindexImageLblimageRelationship1: uniqueIndex(
        "sqlite_autoindex_image_lblimage_relationship_1"
      ).on(table.imageRowid, table.lblimageRowid),
    }
  }
)

export const annotationLblannotRelationshipTable = sqliteTable(
  "annotation_lblannot_relationship",
  {
    alrRowid: integer("alr_rowid").primaryKey(),
    annotRowid: integer("annot_rowid").notNull(),
    lblannotRowid: integer("lblannot_rowid").notNull(),
    alrConfidence: real("alr_confidence"),
  },
  (table) => {
    return {
      sqliteAutoindexAnnotationLblannotRelationship1: uniqueIndex(
        "sqlite_autoindex_annotation_lblannot_relationship_1"
      ).on(table.annotRowid, table.lblannotRowid),
    }
  }
)

export const namesTable = sqliteTable(
  "names",
  {
    nameRowid: integer("name_rowid").primaryKey(),
    nameUuid: numeric("name_uuid").notNull(),
    nameText: text("name_text").notNull(),
    nameNote: text("name_note"),
    nameTempFlag: integer("name_temp_flag").default(0),
    nameAliasText: text("name_alias_text"),
    nameSex: integer("name_sex").default(-1),
    nameMetadataJson: text("name_metadata_json"),
  },
  (table) => {
    return {
      sqliteAutoindexNames1: uniqueIndex("sqlite_autoindex_names_1").on(
        table.nameText
      ),
    }
  }
)

export const imagesTable = sqliteTable(
  "images",
  {
    imageRowid: integer("image_rowid").primaryKey(),
    contributorRowid: integer("contributor_rowid"),
    imageUuid: numeric("image_uuid").notNull(),
    //imageUuid: blob("image_uuid", { mode: "buffer" }).notNull(),
    imageUri: text("image_uri").notNull(),
    imageUriOriginal: text("image_uri_original").notNull(),
    imageExt: text("image_ext").notNull(),
    imageOriginalName: text("image_original_name").notNull(),
    imageWidth: integer("image_width").default(-1),
    imageHeight: integer("image_height").default(-1),
    imageTimePosix: integer("image_time_posix").default(-1),
    imageGpsLat: real("image_gps_lat").default(-1),
    imageGpsLon: real("image_gps_lon").default(-1),
    imageOrientation: integer("image_orientation").default(0),
    imageToggleEnabled: integer("image_toggle_enabled").default(0),
    imageToggleReviewed: integer("image_toggle_reviewed").default(0),
    imageToggleCameratrap: integer("image_toggle_cameratrap").default(
      sql`NULL`
    ),
    imageNote: text("image_note"),
    imageTimedeltaPosix: integer("image_timedelta_posix").default(0),
    imageOriginalPath: text("image_original_path"),
    imageLocationCode: text("image_location_code"),
    partyRowid: integer("party_rowid"),
    imageMetadataJson: text("image_metadata_json"),
  },
  (table) => {
    return {
      sqliteAutoindexImages1: uniqueIndex("sqlite_autoindex_images_1").on(
        table.imageUuid
      ),
    }
  }
)

export const imagesRelations = relations(imagesTable, ({ many }) => ({
  annotations: many(annotationsTable),
}))

export const annotmatch = sqliteTable(
  "annotmatch",
  {
    annotmatchRowid: integer("annotmatch_rowid").primaryKey(),
    annotRowid1: integer("annot_rowid1").notNull(),
    annotRowid2: integer("annot_rowid2").notNull(),
    annotmatchEvidenceDecision: integer("annotmatch_evidence_decision"),
    annotmatchConfidence: integer("annotmatch_confidence"),
    annotmatchTagText: text("annotmatch_tag_text"),
    annotmatchReviewer: text("annotmatch_reviewer"),
    annotmatchPosixtimeModified: integer("annotmatch_posixtime_modified"),
    annotmatchCount: integer("annotmatch_count"),
    annotmatchMetaDecision: integer("annotmatch_meta_decision"),
  },
  (table) => {
    return {
      aid2ToAm: index("aid2_to_am").on(table.annotRowid2),
      aid1ToAm: index("aid1_to_am").on(table.annotRowid1),
      sqliteAutoindexAnnotmatch1: uniqueIndex(
        "sqlite_autoindex_annotmatch_1"
      ).on(table.annotRowid1, table.annotRowid2),
    }
  }
)

export const partsTable = sqliteTable(
  "parts",
  {
    partRowid: integer("part_rowid").primaryKey(),
    partUuid: numeric("part_uuid").notNull(),
    annotRowid: integer("annot_rowid").notNull(),
    partXtl: integer("part_xtl").notNull(),
    partYtl: integer("part_ytl").notNull(),
    partWidth: integer("part_width").notNull(),
    partHeight: integer("part_height").notNull(),
    partTheta: real("part_theta"),
    partNumVerts: integer("part_num_verts").notNull(),
    partVerts: text("part_verts"),
    partViewpoint: text("part_viewpoint"),
    partDetectConfidence: real("part_detect_confidence").default(-1),
    partToggleReviewed: integer("part_toggle_reviewed").default(0),
    partQuality: integer("part_quality"),
    partType: text("part_type"),
    partNote: text("part_note"),
    partTagText: text("part_tag_text"),
    partStagedFlag: integer("part_staged_flag").default(0),
    partStagedUuid: numeric("part_staged_uuid"),
    partStagedUserIdentity: text("part_staged_user_identity"),
    partStagedMetadataJson: text("part_staged_metadata_json"),
    partMetadataJson: text("part_metadata_json"),
    partContourJson: text("part_contour_json"),
  },
  (table) => {
    return {
      aidToPartRowids: index("aid_to_part_rowids").on(table.annotRowid),
      sqliteAutoindexParts1: uniqueIndex("sqlite_autoindex_parts_1").on(
        table.partUuid
      ),
    }
  }
)

export const annotationsTable = sqliteTable(
  "annotations",
  {
    annotRowid: integer("annot_rowid").primaryKey(),
    annotParentRowid: integer("annot_parent_rowid"),
    annotUuid: numeric("annot_uuid").notNull(),
    //annotUuid: blob("annot_uuid", { mode: "buffer" }).notNull(),
    imageRowid: integer("image_rowid").notNull(),
    annotXtl: integer("annot_xtl").notNull(),
    annotYtl: integer("annot_ytl").notNull(),
    annotWidth: integer("annot_width").notNull(),
    annotHeight: integer("annot_height").notNull(),
    annotTheta: real("annot_theta"),
    annotNumVerts: integer("annot_num_verts").notNull(),
    annotVerts: text("annot_verts"),
    annotYaw: real("annot_yaw"),
    annotViewpoint: text("annot_viewpoint"),
    annotDetectConfidence: real("annot_detect_confidence").default(-1),
    annotToggleReviewed: integer("annot_toggle_reviewed").default(0),
    annotToggleMultiple: integer("annot_toggle_multiple").default(sql`NULL`),
    annotToggleInterest: integer("annot_toggle_interest").default(sql`NULL`),
    annotToggleCanonical: integer("annot_toggle_canonical").default(sql`NULL`),
    annotExemplarFlag: integer("annot_exemplar_flag").default(0),
    annotNote: text("annot_note"),
    annotVisualUuid: numeric("annot_visual_uuid").notNull(),
    annotSemanticUuid: numeric("annot_semantic_uuid"),
    nameRowid: integer("name_rowid").default(0),
    speciesRowid: integer("species_rowid").default(0),
    annotQuality: integer("annot_quality"),
    contributorRowid: integer("contributor_rowid"),
    annotAgeMonthsEstMin: integer("annot_age_months_est_min").default(-1),
    annotAgeMonthsEstMax: integer("annot_age_months_est_max").default(-1),
    annotTagText: text("annot_tag_text"),
    annotMetadataJson: text("annot_metadata_json"),
    annotStaticEncounter: text("annot_static_encounter"),
    annotViewpointInt: integer("annot_viewpoint_int"),
    annotStagedFlag: integer("annot_staged_flag").default(0),
    annotStagedUuid: numeric("annot_staged_uuid"),
    annotStagedUserIdentity: text("annot_staged_user_identity"),
    annotStagedMetadataJson: text("annot_staged_metadata_json"),
  },
  (table) => {
    return {
      nidToAids: index("nid_to_aids").on(table.nameRowid),
      gidToAids: index("gid_to_aids").on(table.imageRowid),
      sqliteAutoindexAnnotations2: uniqueIndex(
        "sqlite_autoindex_annotations_2"
      ).on(table.annotVisualUuid, table.annotStagedUuid),
      sqliteAutoindexAnnotations1: uniqueIndex(
        "sqlite_autoindex_annotations_1"
      ).on(table.annotUuid),
    }
  }
)

export const annotationsRelations = relations(annotationsTable, ({ one }) => ({
  image: one(imagesTable, {
    fields: [annotationsTable.imageRowid],
    references: [imagesTable.imageRowid],
  }),
}))

export const imageSetsTable = sqliteTable(
  "imagesets",
  {
    imagesetRowid: integer("imageset_rowid").primaryKey(),
    imagesetUuid: numeric("imageset_uuid").notNull(),
    imagesetText: text("imageset_text").notNull(),
    imagesetOccurrenceFlag: integer("imageset_occurrence_flag").default(0),
    imagesetNote: text("imageset_note").notNull(),
    imagesetStartTimePosix: integer("imageset_start_time_posix"),
    imagesetEndTimePosix: integer("imageset_end_time_posix"),
    imagesetGpsLat: integer("imageset_gps_lat"),
    imagesetGpsLon: integer("imageset_gps_lon"),
    imagesetProcessedFlag: integer("imageset_processed_flag").default(0),
    imagesetShippedFlag: integer("imageset_shipped_flag").default(0),
    imagesetSmartXmlFname: text("imageset_smart_xml_fname"),
    imagesetSmartWaypointId: integer("imageset_smart_waypoint_id"),
    imagesetMetadataJson: text("imageset_metadata_json"),
  },
  (table) => {
    return {
      sqliteAutoindexImagesets1: uniqueIndex("sqlite_autoindex_imagesets_1").on(
        table.imagesetText
      ),
    }
  }
)
