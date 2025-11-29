export interface EncounterSubmissionData {
  id: string
  file: File
  type: string
  presignedUrl: Promise<
    | {
        url: string
        form: FormData
        bucket: string
        key: string
      }
    | undefined
  >
  xhr: XMLHttpRequest
  src: string
  dateTime?: string
  location?: {
    name?: string
    gps?: {
      latitude: number
      longitude: number
    }
  }
  comment?: string
}

export enum ActionTypes {
  ADD = "ADD",
  REMOVE = "REMOVE",
  UPDATE = "UPDATE",
  REORDER = "REORDER",
}

interface AddAction {
  type: ActionTypes.ADD
  payload: EncounterSubmissionData[]
}

interface RemoveAction {
  type: ActionTypes.REMOVE
  payload: {
    id: number | string
  }
}

interface UpdateAction {
  type: ActionTypes.UPDATE
  payload: {
    id: number | string
    data: Partial<EncounterSubmissionData>
  }
}

interface ReorderAction {
  type: ActionTypes.REORDER
  payload: {
    id: number | string
    insertBefore: number | string | undefined
  }
}

export type PayloadTypes =
  | AddAction
  | RemoveAction
  | UpdateAction
  | ReorderAction

export function reducer(
  state: EncounterSubmissionData[],
  action: PayloadTypes
) {
  console.debug("dispatch:", action.type, action.payload)
  switch (action.type) {
    case ActionTypes.ADD: {
      const toAdd = action.payload.filter(
        (encounter) =>
          state.findIndex((existing) => existing.id === encounter.id) === -1
      )
      return [...state, ...toAdd]
    }
    case ActionTypes.REMOVE: {
      const index = state.findIndex((item) => item.id === action.payload.id)
      return index !== -1
        ? [...state.slice(0, index), ...state.slice(index + 1)]
        : state
    }
    case ActionTypes.UPDATE: {
      const index = state.findIndex((item) => item.id === action.payload.id)
      return index !== -1
        ? [
            ...state.slice(0, index),
            { ...state[index], ...action.payload.data },
            ...state.slice(index + 1),
          ]
        : state
    }
    case ActionTypes.REORDER: {
      const fromIndex = state.findIndex((item) => item.id === action.payload.id)

      if (fromIndex !== -1) {
        const [itemToMove] = state.slice(fromIndex, fromIndex + 1)
        const newState = [...state]
        newState.splice(fromIndex, 1)

        const toIndex =
          action.payload.insertBefore !== undefined
            ? newState.findIndex(
                (item) => item.id === action.payload.insertBefore
              )
            : -1
        if (toIndex !== -1) {
          newState.splice(toIndex, 0, itemToMove)
        } else {
          newState.push(itemToMove)
        }
        return newState
      }

      return state
    }
    default: {
      return state
    }
  }
}
