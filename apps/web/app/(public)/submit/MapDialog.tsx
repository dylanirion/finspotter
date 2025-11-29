import {
  Fragment,
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react"
import {
  AdvancedMarker,
  APILoadingStatus,
  ColorScheme,
  Map,
  Pin,
  toLatLngLiteral,
  useApiLoadingStatus,
  useMap,
  type MapCameraChangedEvent,
  type MapCameraProps,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps"
import { Button } from "components/ui/inputs/Button"
import { GridSpinner } from "components/ui/spinners/GridSpinner"
import { useTheme } from "contexts/Theme"
import toast from "react-hot-toast"

import { useSubmission } from "./EncounterSubmissionContext"
import {
  ActionTypes,
  type EncounterSubmissionData,
} from "./EncounterSubmissionReducer"

interface Props {
  mapId: number | string | null
  setMapId: Dispatch<SetStateAction<number | string | null>>
}

const DEFAULT_CAMERA_STATE: MapCameraProps = {
  center: { lat: -34.2129, lng: 18.5905 },
  zoom: 11,
}

export function MapDialog({ mapId, setMapId }: Props) {
  const { data, dispatch } = useSubmission()
  const map = useMap()
  const status = useApiLoadingStatus()
  const [locationGPS, setLocationGPS] = useState<
    | {
        latitude?: number
        longitude?: number
      }
    | undefined
  >(
    mapId
      ? data[data.findIndex((item) => item.id === mapId)].location?.gps
      : undefined
  )
  const [locationName, setLocationName] = useState(
    mapId
      ? data[data.findIndex((item) => item.id === mapId)].location?.name
      : undefined
  )
  const [cameraState, setCameraState] = useState(DEFAULT_CAMERA_STATE)
  const { theme } = useTheme()

  if (status === APILoadingStatus.LOADED && map) {
    const bounds = getBoundsFromEncounters(data)
    const center = !bounds?.isEmpty()
      ? toLatLngLiteral(bounds.getCenter())
      : undefined
    const zoom = !bounds?.isEmpty()
      ? //could get maxZoom {23} from map https://developers.google.com/maps/documentation/javascript/maxzoom but requires network call
        getBoundedZoom(bounds, map.getDiv().offsetWidth, 23)
      : undefined

    // update zoom from default if we have bounds
    if (
      center &&
      zoom &&
      (cameraState.zoom === DEFAULT_CAMERA_STATE.zoom ||
        cameraState.center.lat === DEFAULT_CAMERA_STATE.center.lat ||
        cameraState.center.lng === DEFAULT_CAMERA_STATE.center.lng)
    )
      setCameraState((prev) => ({
        ...prev,
        center,
        zoom,
      }))
  }

  const handleSave = () => {
    if (mapId === null) return
    dispatch({
      type: ActionTypes.UPDATE,
      payload: {
        id: mapId,
        data: {
          location: {
            ...(locationName && { name: locationName }),
            ...(locationGPS?.longitude &&
              locationGPS?.latitude && {
                gps: {
                  longitude: locationGPS?.longitude,
                  latitude: locationGPS?.latitude,
                },
              }),
          },
        },
      },
    })
    setMapId(null)
  }

  const handleCameraChange = useCallback((e: MapCameraChangedEvent) => {
    console.debug("handleCameraChange:", e)
    setCameraState(e.detail)
  }, [])

  const handleClick = useCallback((e: MapMouseEvent) => {
    if (!e.detail.latLng) return
    setLocationGPS({
      longitude: Math.round(e.detail.latLng?.lng * 100000) / 100000,
      latitude: Math.round(e.detail.latLng?.lat * 100000) / 100000,
    })
  }, [])

  if (status === APILoadingStatus.FAILED) {
    toast.error("Something went wrong, please try again.")
  }

  return (
    <Transition appear show={mapId !== null} as={Fragment}>
      <Dialog
        as="div"
        open={mapId !== null}
        onClose={() => setMapId(null)}
        className="relative z-50"
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-gray-500/75 transition-opacity"
            aria-hidden="true"
          />
        </TransitionChild>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-2 text-center sm:p-1">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="relative m-2 h-[calc(100vh_-_5rem)] w-full max-w-7xl overflow-hidden rounded-lg bg-white p-4 text-left shadow-xl transition-all dark:bg-slate-800">
                <div className="h-[calc(100%_-_3rem)] px-2 pt-2 pb-4">
                  {status !== APILoadingStatus.LOADED ? (
                    <GridSpinner className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500" />
                  ) : (
                    <Map
                      fullscreenControl={false}
                      streetViewControl={false}
                      gestureHandling="greedy"
                      onClick={handleClick}
                      onCameraChanged={handleCameraChange}
                      mapTypeId="satellite"
                      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_MAPID}
                      colorScheme={theme?.toUpperCase() as ColorScheme}
                      {...cameraState}
                    >
                      {locationGPS?.latitude && locationGPS?.longitude && (
                        <AdvancedMarker
                          key={mapId}
                          position={{
                            lat: locationGPS.latitude,
                            lng: locationGPS.longitude,
                          }}
                        >
                          <Pin
                            background="#f44336"
                            glyphColor="#d32f2f"
                            borderColor="#d32f2f"
                          />
                        </AdvancedMarker>
                      )}
                      {data
                        .filter((item) => item.id !== mapId)
                        .map(
                          (encounter) =>
                            encounter.location?.gps?.latitude &&
                            encounter.location?.gps?.longitude && (
                              <AdvancedMarker
                                key={encounter.id}
                                position={{
                                  lat: encounter.location.gps.latitude,
                                  lng: encounter.location.gps.longitude,
                                }}
                              >
                                <Pin
                                  background="#9e9e9e"
                                  glyphColor="#757575"
                                  borderColor="#757575"
                                />
                              </AdvancedMarker>
                            )
                        )}
                    </Map>
                  )}
                </div>
                <div className="flex flex-col justify-between sm:flex-row">
                  <div className="flex flex-col space-x-3 sm:flex-row sm:space-y-0">
                    <label htmlFor="longitude" className="sr-only">
                      Longitude
                    </label>
                    <input
                      id="longitude"
                      name="longitude"
                      type="number"
                      min={-180}
                      max={180}
                      className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-700"
                      placeholder="Longitude"
                      value={locationGPS?.longitude ?? ""}
                      autoComplete="off"
                      onChange={(e) =>
                        setLocationGPS((prev) => ({
                          ...prev,
                          longitude: Number(e.target.value),
                        }))
                      }
                    />
                    <label htmlFor="latitude" className="sr-only">
                      Latitude
                    </label>
                    <input
                      id="latitude"
                      name="latitude"
                      type="number"
                      min={-90}
                      max={90}
                      className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-700"
                      placeholder="Latitude"
                      value={locationGPS?.latitude ?? ""}
                      autoComplete="off"
                      onChange={(e) =>
                        setLocationGPS((prev) => ({
                          ...prev,
                          latitude: Number(e.target.value),
                        }))
                      }
                    />
                    <label htmlFor="place-name" className="sr-only">
                      Location Name
                    </label>
                    <input
                      id="place-name"
                      name="place-name"
                      type="text"
                      className="w-40 rounded-md border border-gray-300 bg-white px-3 py-2 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-700"
                      placeholder="Location Name"
                      value={locationName ?? ""}
                      autoComplete="off"
                      onChange={(e) => setLocationName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col space-y-3 space-x-3 sm:flex-row-reverse sm:space-y-0 sm:space-x-reverse">
                    <Button intent="primary" onClick={() => handleSave()}>
                      Save
                    </Button>
                    <Button
                      intent="secondary"
                      onClick={() => {
                        setMapId(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

function getBoundsFromEncounters(encounters: EncounterSubmissionData[]) {
  const bounds = new google.maps.LatLngBounds()
  encounters.forEach((encounter) => {
    if (
      encounter.location?.gps?.latitude &&
      encounter.location?.gps?.longitude
    ) {
      bounds.extend(
        toLatLngLiteral({
          lat: encounter.location.gps.latitude,
          lng: encounter.location.gps.longitude,
        })
      )
    }
  })
  return bounds
}

// https://stackoverflow.com/a/13274361/3473055
function getBoundedZoom(
  bounds: google.maps.LatLngBounds,
  pixelWidth?: number,
  maxZoom: number = 23
) {
  if (!pixelWidth) return undefined
  const GLOBE_WIDTH = 256 // a constant in Google's map projection
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  function latRad(lat: number) {
    const sin = Math.sin((lat * Math.PI) / 180)
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2
  }
  const angle = Math.max(
    ne.lng() - sw.lng() < 0
      ? (ne.lng() - sw.lng() + 360) / 360
      : (ne.lng() - sw.lng()) / 360,
    (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI
  )
  return Math.min(
    Math.floor(Math.log(pixelWidth / angle / GLOBE_WIDTH) / Math.LN2),
    maxZoom
  )
}
