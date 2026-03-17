import { IconChevronDown } from '@tabler/icons-react'
import { useActionState, useEffect, useState } from 'react'
import { formControlStyles } from '../../app/ui'
import { addCharacterAction } from '../../lib/adminActions'
import { notifyDataUpdate } from '../../lib/dataUpdateSignal'
import { INITIAL_FORM_STATE } from '../../lib/formState'
import { FormStatusIndicator } from '../FormStatusIndicator'
import { SubmitButton } from '../SubmitButton'

type StatusValue = 'active' | 'stale'

const statusOptions: Array<{ value: StatusValue, label: string }> = [
  {
    label: 'Active',
    value: 'active',
  },
  {
    label: 'Stale',
    value: 'stale',
  },
]

export function AddCharacterForm() {
  const [state, formAction] = useActionState(addCharacterAction, INITIAL_FORM_STATE)
  const [status, setStatus] = useState<StatusValue>('active')

  useEffect(() => {
    if (state.status === 'success') {
      notifyDataUpdate()
    }
  }, [state.status])

  return (
    <form
      action={formAction}
      className="
        flex min-w-[20rem] flex-1 flex-col gap-5 rounded-2xl border
        border-gray-200 bg-white/90 p-6 shadow-sm ring-1 ring-gray-900/5
        backdrop-blur-sm
        dark:border-gray-700 dark:bg-gray-900/40 dark:ring-white/10
      "
    >
      <div className="space-y-1">
        <h2 className="
          text-lg font-semibold text-gray-900
          dark:text-gray-100
        "
        >
          Add Character
        </h2>
        <p className="
          text-sm text-gray-600
          dark:text-gray-300
        "
        >
          Register a new character to start tracking commissions.
        </p>
      </div>

      <div className="
        grid gap-4
        sm:grid-cols-[minmax(0,1fr)_14rem]
      "
      >
        <div className="space-y-1">
          <label
            htmlFor="add-character-name"
            className="
              text-xs font-semibold tracking-wide text-gray-500 uppercase
              dark:text-gray-300
            "
          >
            Name
          </label>
          <input
            id="add-character-name"
            type="text"
            name="name"
            placeholder="Character name"
            required
            className={formControlStyles}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="add-character-status"
            className="
              text-xs font-semibold tracking-wide text-gray-500 uppercase
              dark:text-gray-300
            "
          >
            Status
          </label>
          <div className="relative">
            <select
              id="add-character-status"
              name="status"
              value={status}
              onChange={event => setStatus(event.target.value as StatusValue)}
              className={`
                ${formControlStyles}
                h-auto appearance-none py-2.5 pr-10
              `}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <IconChevronDown
              className="
                pointer-events-none absolute top-1/2 right-3 size-4
                -translate-y-1/2 text-gray-400
              "
              stroke={1.7}
              aria-hidden="true"
            />
          </div>
          <p className="
            text-xs text-gray-500
            dark:text-gray-400
          "
          >
            This controls where the character appears on the public roster.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <SubmitButton>Save character</SubmitButton>
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            errorFallback="Unable to save character."
          />
        </div>
      </div>
    </form>
  )
}
