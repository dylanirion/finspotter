import { headers } from "next/headers"
import { listOrganizations } from "lib/auth"

//TODO: maybe make this a client component and pass active org from page?
export async function MyOrganization() {
  const organizations = await listOrganizations({ headers: await headers() })
  return (
    <div className="flex flex-col gap-2">
      My Organization
      <div className="rounded-md border border-gray-100 bg-white px-2 dark:border-gray-500 dark:bg-slate-700">
        {organizations?.map((org) => (
          <p key={org.name}>{org.name}</p>
        ))}
      </div>
    </div>
  )
}
