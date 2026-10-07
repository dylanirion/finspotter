"use client"

import { useActionState } from "react"
import { Button } from "components/ui/inputs/Button"

import {
  confirmSubmissionAction,
  createSubmissionAccount,
  saveSubmissionPreferences,
  type FormState,
} from "./actions"

const inputStyle =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
const initialState: FormState = {}

function Feedback({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state.error && (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      )}
      {state.success && <p>{state.success}</p>}
    </div>
  )
}

export function ConfirmationForm({
  submissionId,
  token,
}: {
  submissionId: string
  token: string
}) {
  const [state, action, pending] = useActionState(
    confirmSubmissionAction.bind(null, submissionId, token),
    initialState
  )
  return (
    <form action={action} className="space-y-4">
      <Button type="submit" disabled={pending}>
        {pending ? "Confirming..." : "Confirm email"}
      </Button>
      <Feedback state={state} />
    </form>
  )
}

export function PreferencesForm({
  submissionId,
  enabled,
}: {
  submissionId: string
  enabled: boolean
}) {
  const [state, action, pending] = useActionState(
    saveSubmissionPreferences.bind(null, submissionId),
    initialState
  )
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="updates"
          defaultChecked={enabled}
          className="size-4"
        />
        Email updates for this submission
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save preferences"}
      </Button>
      <Feedback state={state} />
    </form>
  )
}

export function AccountForm({
  submissionId,
  firstName,
  lastName,
  minLength,
  maxLength,
}: {
  submissionId: string
  firstName: string
  lastName: string
  minLength: number
  maxLength: number
}) {
  const [state, action, pending] = useActionState(
    createSubmissionAccount.bind(null, submissionId),
    initialState
  )
  return (
    <form action={action} className="max-w-md space-y-4">
      <label className="block">
        First name
        <input
          name="firstName"
          autoComplete="given-name"
          maxLength={100}
          defaultValue={firstName}
          className={inputStyle}
        />
      </label>
      <label className="block">
        Last name
        <input
          name="lastName"
          autoComplete="family-name"
          maxLength={100}
          defaultValue={lastName}
          className={inputStyle}
        />
      </label>
      <label className="block">
        Password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={minLength}
          maxLength={maxLength}
          className={inputStyle}
        />
      </label>
      <label className="block">
        Confirm password
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={minLength}
          maxLength={maxLength}
          className={inputStyle}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create account"}
      </Button>
      <Feedback state={state} />
    </form>
  )
}
