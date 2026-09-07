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
    /*
    const bbox_xywh = await import("@finspotter/annotation-bbox_xywh")
    const bbox_xywha = await import("@finspotter/annotation-bbox_xywha")
    const segmentation = await import("@finspotter/annotation-segmentation")
    const bbox_xywha_segmentation = await import(
      "@finspotter/annotation-bbox_xywha_segmentation"
    )
    const annotations = [
      bbox_xywh,
      bbox_xywha,
      segmentation,
      bbox_xywha_segmentation,
    ]

    //TODO: expose a notify() function or similar( event?) to display warning when no model or index exists? (ask to upload or train/create)
    const { default: yolact } = await import("@finspotter/yolact")
    const { default: hesaff } = await import("@finspotter/hesaff")
    const { default: faiss } = await import("@finspotter/faiss")
    const { default: pgvector } = await import("@finspotter/pgvector")
    const { default: ratio } = await import("@finspotter/ratio")
    const { default: homog } = await import("@finspotter/homog")
    const { default: sum } = await import("@finspotter/sum")
    */

    const { defineInfra } = await import("./infra")
    const { web } = defineInfra({
      /*
      annotations,
      pipeline: [
        yolact.setAnnotationType(segmentation.name),
        hesaff, //TODO: register ellipse? (separate class from Annotation, just needs draw method)
        faiss,
        pgvector.vector({ hesaff: 128 }),
        ratio,
        homog,
        sum,
      ],
      */
    })

    return {
      url: web.url,
    }
  },
})
