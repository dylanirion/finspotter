import { type Metadata } from "next"

import { FileProcessor } from "./FileProcessor"

export const metadata: Metadata = {
  title: "Import Annotations",
}

export default async function ImportAnnotationsPage() {
  return <FileProcessor />
}
