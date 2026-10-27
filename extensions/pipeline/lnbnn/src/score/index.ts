import { createStorageRepository } from "@finspotter/core/storage"

import { createLnbnnHandler } from "./handler"

export const handler = createLnbnnHandler(createStorageRepository())
