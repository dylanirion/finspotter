import {
  ComponentPropsWithoutRef,
  useCallback,
  type FC,
  type JSX,
  type MouseEvent,
  type PropsWithoutRef,
  type RefAttributes,
  type SVGProps,
} from "react"
import {
  type AnnotationDataTypes,
  type AnnotationType,
} from "@finspotter/annotations/"
import { cn } from "@finspotter/canvas/utils"
import {
  species,
  toAbbreviated,
  type Species,
} from "@finspotter/config/species"
import { type Annotation } from "@finspotter/core/annotation"
import { Spinner } from "@finspotter/web/components/ui/spinners/Spinner"
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react"
import {
  ArrowsRightLeftIcon,
  CheckIcon,
  ChevronUpDownIcon,
  CloudArrowUpIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { type UseMutateAsyncFunction } from "@tanstack/react-query"
import { useSelector } from "@xstate/react"
import toast, { CheckmarkIcon, ErrorIcon } from "react-hot-toast"
import { type StateFrom } from "xstate"

import { type MachineType } from "../"
import { useAnnotation, type ConvertTo } from "./BaseAnnotationLayer"

type IconSVGProps = PropsWithoutRef<SVGProps<SVGSVGElement>> &
  RefAttributes<SVGSVGElement>
type IconProps = IconSVGProps & {
  title?: string
  titleId?: string
}

export type ButtonComponent<P> = (props: P) => JSX.Element

export type RequiredButtonProps<T extends AnnotationType | "null"> = {
  Category: ButtonComponent<CategoryButtonProps>
  Save: ButtonComponent<SaveButtonProps>
  Delete: ButtonComponent<DeleteButtonProps>
  Convert: ButtonComponent<ConvertButtonProps<T>>
}

export type OptionalButton =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- allow any props
  Record<string, ButtonComponent<any>>

export function EditPanelButton(
  props: {
    isActive: boolean
    activeText?: string
    inActiveText: string
    Icon?: FC<IconProps>
  } & ComponentPropsWithoutRef<"button">
) {
  const { isActive, activeText, inActiveText, Icon, ...rest } = props

  return (
    <button
      className={cn(
        "size-8 cursor-pointer rounded-md hover:opacity-75 disabled:cursor-not-allowed",
        {
          "bg-gray-300/60": isActive,
        }
      )}
      title={isActive ? activeText : inActiveText}
      {...rest}
    >
      {Icon && (
        <Icon
          className={cn("block text-gray-300", {
            "text-slate-900": isActive,
          })}
        />
      )}
    </button>
  )
}

interface SaveButtonProps {
  updateAction: (annotation: Annotation) => Promise<void>
  insertAction: (annotation: Annotation) => Promise<{ id?: string }[]>
}

interface DeleteButtonProps {
  deleteAction: (annotation: Annotation) => Promise<void>
}

interface ConvertButtonProps<T extends AnnotationType | "null"> {
  convertActions: Partial<{
    [K in AnnotationType | "null"]: ConvertTo<K>[T]
  }>
  convertType: UseMutateAsyncFunction<
    void,
    Error,
    {
      id: string
      type: AnnotationType | "null"
      data: Partial<AnnotationDataTypes[keyof AnnotationDataTypes]> | null
    },
    unknown
  >
}

interface CategoryButtonProps {
  setCategory: UseMutateAsyncFunction<
    void,
    Error,
    {
      id: string
      category: string | undefined
    },
    unknown
  >
}

function selectEditingState<T extends AnnotationType | "null">(
  state: StateFrom<MachineType<T>>
) {
  // @ts-expect-error: Null machine does not have active.editing state
  return state.matches({ active: "editing" })
}

function selectIdAndCategory<T extends AnnotationType | "null">(
  state: StateFrom<MachineType<T>>
) {
  const { id, category } = state.context
  return { id, category }
}

function selectData<T extends AnnotationType | "null">(
  state: StateFrom<MachineType<T>>
) {
  const { id, data } = state.context
  return { id, data }
}

export function ConvertButton<T extends AnnotationType | "null">({
  convertActions,
  convertType,
}: ConvertButtonProps<T>) {
  const { stateMachine } = useAnnotation()
  const { id, data } = useSelector(stateMachine, selectData)

  const handleConvertAnnotation = useCallback(
    <TTo extends AnnotationType | "null">(
      type: TTo,
      convertFn: ConvertTo<TTo>[T]
    ) => {
      convertFn &&
        convertType({
          id,
          type,
          data: convertFn(data as Parameters<typeof convertFn>[0]),
        })
    },
    [data]
  )

  //TODO: Menu
  return (
    <Menu>
      <MenuButton
        as={EditPanelButton}
        isActive={false}
        inActiveText="Convert"
        Icon={ArrowsRightLeftIcon}
      />
      <MenuItems
        className="ml-1 rounded-md bg-slate-900 p-1 py-1 transition duration-100 ease-in [--anchor-gap:var(--spacing-1)] focus:outline-hidden focus:outline-none data-leave:data-closed:opacity-0"
        anchor="right start"
      >
        {Object.entries(convertActions)?.map(([key, value]) => (
          <MenuItem
            key={key}
            className="flex w-full cursor-pointer"
            as="button"
            onClick={() =>
              handleConvertAnnotation(key as AnnotationType | "null", value)
            }
          >
            {key}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}

export function SaveButton<T extends AnnotationType | "null">({
  updateAction,
  insertAction,
}: SaveButtonProps) {
  const { stateMachine } = useAnnotation()
  const isDisabled = useSelector(stateMachine, selectEditingState)

  const handleSaveOrUpdateAnnotation = useCallback((e: MouseEvent) => {
    e.nativeEvent.stopPropagation()
    const {
      context: { id, type, mediaId, detectionId, data, category, source },
    } = stateMachine.getSnapshot()
    toast.promise<void | { id?: string }[]>(
      !id.startsWith("$")
        ? updateAction({
            id,
            mediaId,
            detectionId,
            category,
            data: data ?? null,
            type: type ?? null,
            source,
          } as Annotation)
        : insertAction({
            mediaId,
            category,
            data: data ?? null,
            type: type ?? null,
            source,
          } as Annotation),
      {
        loading: !id.startsWith("$") ? "Updating..." : "Adding...",
        success: !id.startsWith("$")
          ? "Annotation updated!"
          : "Annotation added!",
        error: "Something went wrong, please try again.",
      },
      {
        loading: {
          icon: <Spinner className="size-5 animate-spin text-indigo-600" />,
        },
        success: {
          icon: <CheckmarkIcon />,
        },
        error: {
          icon: <ErrorIcon />,
        },
      }
    )
  }, [])

  return (
    <EditPanelButton
      isActive={false}
      inActiveText="Save"
      disabled={isDisabled}
      onClick={handleSaveOrUpdateAnnotation}
      Icon={CloudArrowUpIcon}
    />
  )
}

//TODO: warn if attached to individual!
export function DeleteButton<T extends AnnotationType | "null">({
  deleteAction,
}: DeleteButtonProps) {
  const { index, stateMachine } = useAnnotation()
  const isDisabled = useSelector(stateMachine, selectEditingState)

  const handleDeleteAnnotation = useCallback(
    (e: MouseEvent) => {
      e.nativeEvent.stopPropagation()
      const {
        context: { shape: _shape, ...annotation },
      } = stateMachine.getSnapshot()
      toast.promise(
        deleteAction(annotation as Annotation),
        {
          loading: "Deleting...",
          success: "Annotation deleted!",
          error: "Something went wrong, please try again.",
        },
        {
          loading: {
            icon: <Spinner className="size-5 animate-spin text-indigo-400" />,
          },
          success: {
            icon: <CheckmarkIcon />,
          },
          error: {
            icon: <ErrorIcon />,
          },
        }
      )
    },
    [index]
  )

  return (
    <EditPanelButton
      isActive={false}
      inActiveText="Delete"
      disabled={isDisabled}
      onClick={handleDeleteAnnotation}
      Icon={TrashIcon}
    />
  )
}

export function CategoryListbox({ setCategory }: CategoryButtonProps) {
  const { stateMachine } = useAnnotation()
  const { id, category } = useSelector(stateMachine, selectIdAndCategory)

  const handleChangeCategory = useCallback((value: string) => {
    stateMachine.send({ type: "set.category", value })
    setCategory({ id, category: value })
  }, [])

  return (
    <Listbox value={category ?? ""} onChange={handleChangeCategory}>
      <ListboxButton className="relative w-full pr-8 pl-3 text-left hover:opacity-75 focus:outline-hidden">
        <span className="block truncate">
          {category
            ? toAbbreviated(species[category as Species].scientificName)
            : "Unknown"}
        </span>
        <ChevronUpDownIcon
          className="pointer-events-none absolute inset-y-0.5 right-0.5 size-5 text-gray-400"
          aria-hidden="true"
        />
      </ListboxButton>
      <ListboxOptions
        className="mt-1 max-h-60 w-[var(--button-width)] rounded-md bg-slate-900 p-1 py-1 transition duration-100 ease-in [--anchor-gap:var(--spacing-1)] focus:outline-hidden focus:outline-none data-leave:data-closed:opacity-0"
        anchor="bottom"
      >
        {Object.keys(species).map((key) => (
          <ListboxOption
            key={key}
            className="group flex cursor-default items-center gap-1 px-1 text-gray-300 select-none data-focus:bg-gray-300 data-focus:text-slate-900"
            value={key}
          >
            <CheckIcon
              className="invisible size-5 shrink-0 group-data-selected:visible"
              aria-hidden="true"
            />
            <span className="truncate">
              {toAbbreviated(species[key as Species].scientificName)}
            </span>
          </ListboxOption>
        ))}
        <ListboxOption
          className="group flex cursor-default items-center gap-1 px-1 text-gray-300 select-none data-focus:bg-gray-300 data-focus:text-slate-900"
          value={""}
        >
          <CheckIcon
            className="invisible size-5 shrink-0 group-data-selected:visible"
            aria-hidden="true"
          />
          <span className="truncate">Unknown</span>
        </ListboxOption>
      </ListboxOptions>
    </Listbox>
  )
}
