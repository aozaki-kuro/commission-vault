'use client'

import { useActionState } from 'react'

import { addCharacterAction } from '#admin/actions'
import SubmitButton from './SubmitButton'
import { INITIAL_FORM_STATE } from './types'

const AddCharacterForm = () => {
  const [state, formAction] = useActionState(addCharacterAction, INITIAL_FORM_STATE)

  return (
    <form
      action={formAction}
      className="h-full space-y-4 rounded-lg border border-gray-200 p-4 shadow-sm dark:border-gray-700"
    >
      <div>
        <h2 className="text-lg font-medium">Add Character</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Register a new character to start tracking commissions.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Name
          </span>
          <input
            type="text"
            name="name"
            placeholder="Character name"
            required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>

        <label className="w-full sm:w-40">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Status
          </span>
          <select
            name="status"
            defaultValue="active"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="active">Active</option>
            <option value="stale">Stale</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving character...">Save character</SubmitButton>
        {state.status === 'error' && (
          <p className="text-sm text-red-500">{state.message ?? 'Unable to save character.'}</p>
        )}
        {state.status === 'success' && (
          <p className="text-sm text-green-600">{state.message ?? 'Character created.'}</p>
        )}
      </div>
    </form>
  )
}

export default AddCharacterForm
