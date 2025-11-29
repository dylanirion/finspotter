import {
  useCallback,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react"
import { Field, Label, Radio, RadioGroup } from "@headlessui/react"
import { MinusCircleIcon, PlusCircleIcon } from "@heroicons/react/24/outline"
import { Button } from "components/ui/inputs/Button"
import { useListOrganizations, useSession } from "hooks/useSession"

export function AddUserDataStep({ title }: { title: string }) {
  const _title = title

  //TODO: ask if submitting personally or as part of organization if user and member?
  //TODO: if user, ask communication preference for this submission (default checked)

  return (
    <>
      <div className="flex justify-center pt-3">
        <div className="w-2/3 space-y-2 rounded-md border border-gray-100 bg-white p-5 shadow-xl dark:border-gray-500 dark:bg-slate-700">
          <ContactDetails />
          <InformOthers />
        </div>
      </div>
    </>
  )
}

//TODO: controlled inputs to maintain state on error
function ContactDetails() {
  const { data: session } = useSession()
  const user = session?.user

  //TODO: if admin, allow submitting on behalf of others. (show inputs, and allow in action?)
  if (user) return <OrganizationDetails />
  return (
    <>
      <div className="flex space-x-2">
        <label
          htmlFor="firstName"
          className="block flex-1 text-sm leading-6 font-medium"
        >
          First Name
          <input
            type="text"
            id="firstName"
            name="firstName"
            className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-800"
            placeholder="Happy"
            autoComplete="given-name"
            required
          />
        </label>
        <label
          htmlFor="lastName"
          className="block flex-1 text-sm leading-6 font-medium"
        >
          Last Name
          <input
            type="text"
            id="lastName"
            name="lastName"
            className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-800"
            placeholder="Eddie"
            autoComplete="family-name"
            required
          />
        </label>
      </div>
      <label htmlFor="email" className="block text-sm leading-6 font-medium">
        Your Email
        <input
          type="email"
          id="email"
          name="email"
          className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-800"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
    </>
  )
}

function OrganizationDetails() {
  const { data: organizations } = useListOrganizations()

  if (!organizations) return

  return (
    <>
      <span>
        You belong to an organization, are you submitting on their behalf?
      </span>
      <div className="flex w-full flex-col items-start space-y-2">
        <RadioGroup
          name="organization"
          defaultValue={organizations[0].slug}
          aria-label="Select Organization"
        >
          {[...organizations, null].map((org, i) => (
            <Field key={i} className="flex items-center first:mt-2">
              <Radio
                className="group flex size-5 items-center justify-center rounded-full border bg-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:data-disabled:bg-gray-500 dark:border-slate-500 dark:bg-slate-700"
                value={org?.slug ?? null}
              >
                <span className="invisible size-2 rounded-full bg-white group-data-checked:visible" />
              </Radio>
              <Label className="ml-2">
                {org?.name ?? "Submitting personally"}
              </Label>
            </Field>
          ))}
        </RadioGroup>
      </div>
    </>
  )
}

function InformOthers() {
  const [inputs, setInputs] = useState([{ email: "" }])

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>, i: number) => {
      e.preventDefault()
      //split and add inputs on "," or ";"
      const value = e.clipboardData.getData("text")
      setInputs((prev) => [
        ...prev.filter((item) => item.email !== ""),
        ...value.split(/,|;/).map((item) => ({ email: item })),
      ])
    },
    []
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>, index: number) => {
      setInputs((prev) =>
        prev.map((obj, i) =>
          i == index ? { ...obj, email: e.target.value } : obj
        )
      )
    },
    []
  )

  const handleAddInput = useCallback(() => {
    setInputs((prev) => [...prev, { email: "" }])
  }, [])

  const handleDeleteInput = useCallback((i: number) => {
    setInputs((prev) => prev.toSpliced(i, 1))
  }, [])

  return (
    <>
      <span>
        Was anyone else with you that might like to be notified if we see any of
        these sharks again?
      </span>
      <div className="flex w-full flex-col items-start space-y-2">
        {inputs.map((item, i) => (
          <div className="flex w-full items-center first:mt-2" key={i}>
            <input
              type="email"
              name="emailOthers"
              value={item.email}
              className="flex-grow rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-hidden sm:text-sm dark:border-gray-500 dark:bg-slate-800"
              autoComplete="off"
              placeholder="them@example.com"
              onChange={(e) => handleChange(e, i)}
              onPaste={(e) => handlePaste(e, i)}
            />
            <div className="ml-2 flex w-16 flex-shrink-0 items-center space-x-2">
              {inputs.length > 1 && (
                <Button
                  intent="none"
                  size="none"
                  onClick={() => handleDeleteInput(i)}
                >
                  <MinusCircleIcon className="size-6 stroke-red-600" />
                  <span className="sr-only">Delete</span>
                </Button>
              )}
              {i === inputs.length - 1 && (
                <Button intent="none" size="none" onClick={handleAddInput}>
                  <PlusCircleIcon className="size-6 stroke-blue-600" />
                  <span className="sr-only">Add</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
