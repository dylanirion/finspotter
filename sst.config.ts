// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "finspotter",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          profile:
            input.stage === "production" ? "finspotter-prod" : "finspotter-dev",
        },
        "docker-build": "latest",
        gcp: {
          version: "latest",
          project: "finspotter",
        },
        neon: "latest",
      },
    }
  },
  async run() {
    const annotations = [
      await import("@finspotter/annotation-bbox_xywh"),
      await import("@finspotter/annotation-bbox_xywha"),
      await import("@finspotter/annotation-segmentation"),
      await import("@finspotter/annotation-bbox_xywha_segmentation"),
    ]
    //TODO: expose a notify() function or similar( event?) to display warning when no model or index exists? (ask to upload or train/create)
    const yolact = await import("@finspotter/yolact").then((mod) => mod.default)
    const hesaff = await import("@finspotter/hesaff").then((mod) => mod.default)
    const faiss = await import("@finspotter/faiss").then((mod) => mod.default)
    const pgvector = await import("@finspotter/pgvector").then(
      (mod) => mod.default
    )
    const ratio = await import("@finspotter/ratio").then((mod) => mod.default)
    const homog = await import("@finspotter/homog").then((mod) => mod.default)
    const sum = await import("@finspotter/sum").then((mod) => mod.default)
    const _infra = await import("./infra").then((mod) =>
      mod.init(
        [
          yolact.setAnnotationType(annotations[2].name), //segmentation
          hesaff, //TODO: register ellipse? (separate class from Annotation, just needs draw method)
          faiss,
          pgvector.vector({ hesaff: 128 }),
          ratio,
          homog,
          sum,
        ],
        annotations
      )
    )
    /*
                return {
                  url: infra.web?.url,
                }
                */
  },
})
