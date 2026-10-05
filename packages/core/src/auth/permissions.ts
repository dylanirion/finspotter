import { type Annotation } from "../annotation"
import { type Media } from "../media"
import { type Organization } from "../organization"
import { type User } from "../user"

//TODO: resource type for routes?

//TODO: admin is reserved for the global context, and user is default, maybe they should be specified separately?
export type Role = "admin" | "manager" | "matcher" | "annotator" | "user"

//TODO: change to more "understandable" verbs read->view, update->add, etc
type CrudAction = "create" | "read" | "update" | "delete"
type ReviewAction = "review" | "auto_review"
type OrgAction = "invite" | "remove"
type MLAction = "train"

type PermissionUser = {
  role?: string | null
  organizations?: Record<string, string | string[]>
}

type ResourceType = {
  Annotation: Annotation[]
  Media: Media[]
  Organization: Organization[]
  User: User[]
}

type ActionPermissions<T> = Partial<
  Record<
    CrudAction | ReviewAction,
    boolean | ((user: PermissionUser | undefined, data: T) => boolean)
  >
> &
  Partial<
    Record<
      OrgAction,
      T extends Organization[]
        ?
            | boolean
            | ((
                user: PermissionUser | undefined,
                data: Organization[]
              ) => boolean)
        : never
    >
  >

type ResourcePermissions = {
  [K in keyof ResourceType]: ActionPermissions<ResourceType[K]>
}

type RolePermissions = Record<Role, Partial<ResourcePermissions>>

const permissions: RolePermissions = {
  admin: {
    Annotation: {
      create: true,
      update: true,
      delete: true,
      review: true,
      auto_review: true,
    },
    Media: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    Organization: {
      create: true,
      read: true,
      update: true,
      delete: true,
      invite: true,
      remove: true,
    },
  },
  manager: {
    Organization: {
      update: (manager, organizations) => {
        //TODO: manager can update an organization they are a manager of
        return false
      },
      invite: (manager, organizations) => {
        //TODO: manager can invite users to an organization they are a manager of
        return false
      },
      remove: (manager, organizations) => {
        //TODO: manager can invite users to an organization they are a manager of
        return false
      },
    },
  },
  matcher: {
    Annotation: {
      review: true,
    },
  },
  annotator: {},
  user: {
    Media: {
      create: true,
      //TODO: media.restricted: 'organization' | 'private'
      read: (user, media) => {
        //TODO: users can view private(any) media if they own it
        //TODO: users can always view restricted media from their organization
        //TODO: users an view restricted media if they have been granted access (pull from table, include optional time range)
        return false
      },
    },
  },
}

export function can<
  R extends keyof ResourceType,
  A extends CrudAction | ReviewAction,
>(
  user: PermissionUser | undefined,
  action: A,
  resource: R,
  data?: ResourceType[R]
): boolean {
  // check role base permissions
  const organizations = user?.organizations ?? {}
  const globalRole = user && "role" in user ? user.role : undefined
  const hasRolePermission = [globalRole, ...Object.values(organizations).flat()]
    .filter((role): role is string => typeof role === "string")
    .some((role) => {
      const permission =
        permissions[role as keyof RolePermissions][resource]?.[action]
      if (!permission) return false
      if (typeof permission === "boolean") return permission
      return data && permission(user, data)
    })
  if (hasRolePermission) return true
  //TODO: check ad-hoc permissions
  return false
}

//TODO: helper function for database where clause
/*
SELECT c.customer_id, c.name, c.email, c.sensitive_data
FROM customers c
WHERE EXISTS (
  SELECT 1
  FROM user_attributes ua
  WHERE ua.user_id = [current_user_id]
    AND ua.attribute_name = 'role'
    AND ua.attribute_value = 'manager'
) AND EXISTS (
  SELECT 1
  FROM user_attributes ua
  WHERE ua.user_id = [current_user_id]
    AND ua.attribute_name = 'security_clearance'
    AND ua.attribute_value = 'top_secret'
);
*/
