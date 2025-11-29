import { DragEvent, useCallback, useRef } from "react"
import { Img } from "components/ui/images/Img"

export function DemoImage({ src, name }: { name: string; src: string }) {
  const imageRef = useRef<HTMLImageElement>(null)

  const handleDragStart = useCallback(async (e: DragEvent) => {
    e.dataTransfer.effectAllowed = "copy"
    e.dataTransfer.setDragImage(imageRef.current as Element, 0, 0)
    for (let i = e.dataTransfer.items.length - 1; i >= 0; i--) {
      //dataTransferList somehow loses type on drop? allowing empty type on permittedTypes for now
      //dataTransferList is also not available in dragstart on safari
      if (
        e.dataTransfer.items[i].kind !== "file" &&
        !(
          e.dataTransfer.items[i].type.match(/^image\/webp/) ||
          e.dataTransfer.items[i].type.match(/^image\/jpeg/)
        )
      ) {
        e.dataTransfer.items.remove(i)
      }
    }
  }, [])

  return (
    <div className="w-24 sm:w-32" onDragStart={(e) => handleDragStart(e)}>
      <Img
        ref={imageRef}
        className="absolute cursor-grab rounded object-cover object-center hover:opacity-75"
        src={src}
        fill
        alt={name}
        draggable={true}
        sizes="75vw"
        {...(process.env.NODE_ENV === "development"
          ? {
              crossOrigin: "anonymous",
            }
          : {})}
      />
    </div>
  )
}
