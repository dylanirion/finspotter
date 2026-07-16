import { getAnnotationComponents } from "@finspotter/annotations/react"
import { Canvas } from "@finspotter/canvas"
import { MediaLayer } from "@finspotter/canvas/media"
import { type Media } from "@finspotter/core/media"
import { getAnnotationTypes } from "@finspotter/pipeline"
import { useQuery } from "@tanstack/react-query"
import { getDetections } from "app/_actions/pipeline"
import { twCols } from "lib/utils"

export function AboutCanvas({ id, media }: { id: string; media?: Media }) {
  const { data: annotations } = useQuery({
    queryKey: [id, "detections"],
    queryFn: () => getDetections({ pk: id }),
    initialData: [],
  })
  if (!media) return

  return (
    <Canvas
      key={media?.id}
      id={media?.id}
      className="rounded-md shadow-md"
      isProcessing={!annotations.length}
      width={media.exif?.width}
      height={media.exif?.height}
    >
      <MediaLayer media={media}>
        {annotations.map((annotation, i) => {
          //TODO: just write type to database
          const type = getAnnotationTypes[annotation.type]
          const { AnnotationLayer } = getAnnotationComponents(type ?? "null")
          return (
            <AnnotationLayer
              key={i}
              index={i}
              active={true}
              annotation={{
                id: String(i),
                mediaId: media.id,
                type,
                data: annotation.data,
              }}
              style={{ color: twCols[i % twCols.length].hex, glow: true }}
              editable={false}
            />
          )
        })}
      </MediaLayer>
    </Canvas>
  )
}
