'use client'

import { useActionState, useMemo } from 'react'

import type { CharacterStatus } from '#lib/admin/db'
import { addCommissionAction } from '#admin/actions'
import SubmitButton from './SubmitButton'
import { INITIAL_FORM_STATE } from './types'

interface CharacterOption {
  id: number
  name: string
  status: CharacterStatus
  sortOrder: number
}

interface AddCommissionFormProps {
  characters: CharacterOption[]
}

const AddCommissionForm = ({ characters }: AddCommissionFormProps) => {
  const [state, formAction] = useActionState(addCommissionAction, INITIAL_FORM_STATE)

  const options = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters],
  )

  return (
    <form
      action={formAction}
      className="h-full space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm dark:border-gray-700"
    >
      <div>
        <h2 className="text-lg font-medium">Add Commission Entry</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Append a new commission record to an existing character. Links accept multiple lines.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Character
          </span>
          <select
            name="characterId"
            required
            defaultValue=""
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="" disabled>
              Select character
            </option>
            {options.map(option => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.status})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            File name
          </span>
          <input
            type="text"
            name="fileName"
            placeholder="20250302_Artist"
            required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          Links (one per line)
        </span>
        <textarea
          name="links"
          placeholder="https://example.com"
          rows={4}
          required
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Design (optional)
          </span>
          <input
            type="text"
            name="design"
            placeholder="Design reference"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Description (optional)
          </span>
          <input
            type="text"
            name="description"
            placeholder="Short description"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          name="hidden"
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-700 dark:text-gray-100"
        />
        Hidden
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving commission...">Save commission</SubmitButton>
        {state.status === 'error' && (
          <p className="text-sm text-red-500">{state.message ?? 'Unable to save commission.'}</p>
        )}
        {state.status === 'success' && (
          <p className="text-sm text-green-600">{state.message ?? 'Commission saved.'}</p>
        )}
      </div>
    </form>
  )
}

export default AddCommissionForm
