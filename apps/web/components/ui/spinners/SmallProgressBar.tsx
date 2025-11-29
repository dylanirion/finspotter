//TODO: className prop for height & width, maybe prop for color?
export function SmallProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1.5 w-48 rounded-full bg-gray-200">
      <div
        className="h-1.5 rounded-full bg-blue-600"
        style={{ width: progress + "%" }}
      ></div>
    </div>
  )
}
