import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type Dispatch,
  type DragEvent,
  type DragEventHandler,
  type ReactNode,
  type SetStateAction,
} from "react"

export interface DropZoneProps {
  className?: string
  fileList?: File[]
  setFileList?: Dispatch<SetStateAction<File[] | undefined>>
  isDragging?: boolean
  setDragging?: Dispatch<SetStateAction<boolean>>
  permittedTypes?: Array<string>
  multiple?: boolean
  onDragStart?: DragEventHandler
  onDragEnd?: DragEventHandler
  onDragOver?: DragEventHandler
  onDragEnter?: DragEventHandler
  onDragLeave?: DragEventHandler
  onDrop?: DragEventHandler
  onChange?: ChangeEventHandler<HTMLInputElement>
  isDisabled?: boolean
  children?:
    | ReactNode
    | (({
        handleOpenFileInput,
      }: {
        handleOpenFileInput: () => void
      }) => ReactNode)
}

const dropEffects = {
  none: "none" as const,
  copy: "copy" as const,
  move: "move" as const,
}

function isAllPermittedTypes(
  files: DataTransferItemList | FileList | File[],
  types: Array<string>
) {
  const permitted: boolean[] = []
  for (let i = 0; i < files.length; i++) {
    permitted.push(types.includes(files[i].type))
  }
  return permitted.every((element) => element === true)
}

//TODO: show disabled icon until event handlers attached for slow internet connections
export function DropZone({
  className,
  isDragging,
  setDragging,
  permittedTypes,
  multiple = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onChange,
  isDisabled,
  children,
  ...other
}: DropZoneProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragTargetsRef = useRef<EventTarget[]>([]) // track targets entered and left
  const [over, setOver] = useState(false)

  const handleOpenFileInput = useCallback(() => {
    inputRef.current && inputRef.current.click()
  }, [])

  const onDocumentDragOver = useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  const onDocumentDrop = useCallback((e: Event) => {
    if (divRef.current && divRef.current.contains(e.target as Node)) return
    e.preventDefault()
    dragTargetsRef.current = []
  }, [])

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      setDragging && setDragging(true)
      onDragStart && onDragStart(e)
    },
    [onDragStart, setDragging]
  )

  const handleDragEnd = useCallback(
    (e: DragEvent) => {
      setDragging && setDragging(false)
      onDragEnd && onDragEnd(e)
    },
    [onDragEnd, setDragging]
  )

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      dragTargetsRef.current = [...dragTargetsRef.current, e.target]
      /* Code to filter draggable items isn't working on safari
      if (
        (permittedTypes &&
          !isAllPermittedTypes(e.dataTransfer.items, permittedTypes)) ||
        isDisabled
      ) {
        e.dataTransfer.dropEffect = dropEffects.none
        return
      }
      */

      e.dataTransfer.dropEffect = dropEffects.copy
      setOver(true)
      onDragEnter && onDragEnter(e)
    },
    [onDragEnter, setOver /*permittedTypes,  isDisabled*/]
  )

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      // Trigger leave only after all children have been left
      const targets = dragTargetsRef.current.filter(
        (target) => divRef.current && divRef.current.contains(target as Node)
      )
      const targetIdx = targets.indexOf(e.target)

      if (targetIdx !== -1) targets.splice(targetIdx, 1)
      dragTargetsRef.current = targets
      if (targets.length > 0) return

      e.dataTransfer.dropEffect = dropEffects.none
      setOver(false)
      onDragLeave && onDragLeave(e)
    },
    [onDragLeave, setOver]
  )

  // requestAnimationFrame?
  const handleDragOver = useCallback(
    (e: DragEvent) => {
      /* Code to filter draggable items isn't working on safari
      if (
        (permittedTypes &&
          !isAllPermittedTypes(e.dataTransfer.items, permittedTypes)) ||
        isDisabled
      ) {
        e.dataTransfer.dropEffect = dropEffects.none
        return
      }
      */

      e.dataTransfer.dropEffect = dropEffects.copy
      setOver(true)
      onDragOver && onDragOver(e)
    },
    [onDragOver, setOver /*permittedTypes, isDisabled*/]
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!inputRef?.current) return

      dragTargetsRef.current = []
      const files: File[] = [...e.dataTransfer.files].sort((a, b) =>
        a.name > b.name ? 1 : b.name > a.name ? -1 : 0
      )
      setDragging && setDragging(false)
      setOver(false)
      if (files && files.length > 0) {
        if (
          (permittedTypes && !isAllPermittedTypes(files, permittedTypes)) ||
          isDisabled
        )
          return
        inputRef.current.files = e.dataTransfer.files
        inputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
      }
      onDrop && onDrop(e)
    },
    [onDrop, permittedTypes, setDragging, setOver, isDisabled, inputRef]
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files: File[] = [...Array.from(e.target.files!)].sort((a, b) =>
        a.name > b.name ? 1 : b.name > a.name ? -1 : 0
      )

      if (files && files.length > 0) {
        if (
          (permittedTypes && !isAllPermittedTypes(files, permittedTypes)) ||
          isDisabled
        )
          return
      }
      console.debug("got permitted files:", files)
      onChange && onChange(e)
    },
    [onChange, permittedTypes, isDisabled]
  )

  useEffect(() => {
    const controller = new AbortController()
    console.debug("attaching document drag event listeners")
    document.addEventListener("dragover", onDocumentDragOver, {
      capture: false,
      signal: controller.signal,
    })
    document.addEventListener("drop", onDocumentDrop, {
      capture: false,
      signal: controller.signal,
    })

    return () => {
      console.debug("removing document drag event listeners")
      controller.abort()
    }
  }, [onDocumentDrop, onDocumentDragOver])

  return (
    <div
      ref={divRef}
      className={className}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      {...(over && { "data-over": true })}
      {...other}
    >
      {children instanceof Function
        ? children({ handleOpenFileInput })
        : children}
      <input
        className="hidden"
        ref={inputRef}
        type="file"
        accept={permittedTypes?.join(", ") ?? undefined}
        onChange={handleFileChange}
        multiple={multiple}
        disabled={isDisabled}
      />
    </div>
  )
}
