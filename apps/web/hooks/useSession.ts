import { type auth } from "@finspotter/core/auth"
import { useQuery, type AnyUseQueryOptions } from "@tanstack/react-query"
import {
  adminClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient(),
    adminClient(),
  ],
})

export type Session = typeof authClient.$Infer.Session
export type Organization = typeof authClient.$Infer.Organization

export const { signIn, signUp, signOut, forgetPassword, resetPassword } =
  authClient

export function useSession(options?: Partial<AnyUseQueryOptions>) {
  const result = useQuery<Session>({
    queryKey: ["session"],
    queryFn: () => authClient.getSession({ fetchOptions: { throw: true } }),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  })

  return {
    data: result.data as Session | undefined,
    isPending: result.isPending,
    error: result.error,
    refetch: result.refetch,
  }
}

export function useListOrganizations(options?: Partial<AnyUseQueryOptions>) {
  const result = useQuery<Organization[] | null>({
    queryKey: ["organizations"],
    queryFn: () =>
      authClient.organization.list({ fetchOptions: { throw: true } }),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  })

  return {
    data: result.data as Organization[] | null,
    isPending: result.isPending,
    error: result.error,
    refetch: result.refetch,
  }
}
