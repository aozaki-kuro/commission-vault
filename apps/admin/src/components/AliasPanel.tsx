import type { FormState } from '../lib/formState'
import { useActionState, useMemo, useState } from 'react'
import { adminSurfaceStyles, formControlStyles } from '../app/ui'
import { INITIAL_FORM_STATE } from '../lib/formState'
import { FormStatusIndicator } from './FormStatusIndicator'
import { SaveButton } from './SaveButton'

export interface AliasRow {
  key: string
  count: number
  initialValue: string
}

interface AliasPanelProps {
  rows: AliasRow[]
  formAction: (state: FormState, data: FormData) => FormState | Promise<FormState>
  title: string
  description: string
  saveLabel: string
  errorFallback: string
  emptyMessage: string
  columnHeader: string
  placeholder?: string
  buildPayload: (rows: AliasRow[], drafts: Record<string, string>) => string
}

const panelHeaderTitleStyles = 'text-base font-semibold text-gray-900 dark:text-gray-100'
const panelHeaderDescriptionStyles = 'text-sm text-gray-600 dark:text-gray-300'
const tableHeaderStyles
  = 'hidden gap-4 border-b border-gray-200/80 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase md:grid dark:border-gray-700/80 dark:text-gray-300'
const tableRowStyles = 'grid gap-4 px-4 py-3 md:items-center'
const tableDividerStyles = 'border-t border-gray-200/80 dark:border-gray-700/80'
const aliasGridTemplate = 'md:grid-cols-[minmax(10rem,16rem)_minmax(0,1fr)]'

export function AliasPanel({
  rows,
  formAction,
  title,
  description,
  saveLabel,
  errorFallback,
  emptyMessage,
  columnHeader,
  placeholder,
  buildPayload,
}: AliasPanelProps) {
  const [state, action] = useActionState(formAction, INITIAL_FORM_STATE)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(row => [row.key, row.initialValue])),
  )

  const rowsPayload = useMemo(
    () => buildPayload(rows, drafts),
    [buildPayload, rows, drafts],
  )

  return (
    <form action={action} className={adminSurfaceStyles}>
      <input type="hidden" name="rowsJson" value={rowsPayload} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className={panelHeaderTitleStyles}>{title}</h3>
          <p className={panelHeaderDescriptionStyles}>{description}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormStatusIndicator
            status={state.status}
            message={state.message}
            successLabel="Saved"
            errorFallback={errorFallback}
          />
          <SaveButton label={saveLabel} />
        </div>
      </div>

      {rows.length === 0
        ? (
            <p className="
              text-sm text-gray-600
              dark:text-gray-300
            "
            >
              {emptyMessage}
            </p>
          )
        : (
            <div className="space-y-0">
              <div className={`
                ${tableHeaderStyles}
                ${aliasGridTemplate}
              `}
              >
                <div>{columnHeader}</div>
                <div>Aliases</div>
              </div>

              {rows.map(row => (
                <div
                  key={row.key}
                  className={`
                    ${tableRowStyles}
                    ${aliasGridTemplate}
                    ${tableDividerStyles}
                    first:border-t-0
                  `}
                >
                  <div className="space-y-1">
                    <div className="
                      text-sm font-semibold text-gray-900
                      dark:text-gray-100
                    "
                    >
                      {row.key}
                    </div>
                    <p className="
                      text-xs text-gray-500
                      dark:text-gray-400
                    "
                    >
                      {row.count}
                      {' '}
                      commission
                      {row.count === 1 ? '' : 's'}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={drafts[row.key] ?? ''}
                    onChange={event =>
                      setDrafts(prev => ({
                        ...prev,
                        [row.key]: event.target.value,
                      }))}
                    className={formControlStyles}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          )}
    </form>
  )
}
