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
          version: "latest",
          profile:
            input.stage === "production" ? "finspotter-prod" : "finspotter-dev",
        },
        gcp: {
          version: "latest",
          project: "finspotter",
          region: "africa-south1",
          billingProject: "finspotter",
        },
        command: "latest",
        neon: "latest",
      },
    }
  },
  async run() {
    const bbox_xywh = await import("@finspotter/annotation-bbox_xywh")
    const bbox_xywha = await import("@finspotter/annotation-bbox_xywha")
    const segmentation = await import("@finspotter/annotation-segmentation")
    const bbox_xywhaSegmentation =
      await import("@finspotter/annotation-bbox_xywha_segmentation")
    const annotationExtensions = [
      bbox_xywh,
      bbox_xywha,
      segmentation,
      bbox_xywhaSegmentation,
    ] as const
    const { generateAnnotationConfigs } =
      await import("@finspotter/annotations/generator")
    await generateAnnotationConfigs(annotationExtensions)

    //TODO: expose a notify() function or similar( event?) to display warning when no model or index exists? (ask to upload or train/create)
    const { default: yolact } = await import("@finspotter/yolact")
    const { default: hesaff } = await import("@finspotter/hesaff")
    const { default: faiss } = await import("@finspotter/faiss")
    const { default: ratio } = await import("@finspotter/ratio")
    const { default: homog } = await import("@finspotter/homog")
    const { default: sum } = await import("@finspotter/sum")
    /*
    const { default: pgvector } = await import("@finspotter/pgvector")
    */

    const { defineInfra } = await import("./infra")
    const { web } = defineInfra({
      pipeline: [
        yolact.setAnnotationType(segmentation.annotation.name),
        hesaff, //TODO: register ellipse? (separate class from Annotation, just needs draw method)
        faiss,
        ratio,
        homog,
        sum,
        /*
        pgvector.vector({ hesaff: 128 }),
        */
      ],
    })

    return {
      url: web.url,
    }
  },
})
