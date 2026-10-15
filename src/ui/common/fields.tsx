import { useId, useState, type ReactNode } from 'react'

/** Text applied on blur or Enter only (the name of a play renames its file, D-005). */
export function CommitTextField(props: {
  label: string
  value: string
  onCommit: (value: string) => void
  disabled?: boolean
  multiline?: boolean
  maxLengthHint?: number
  hint?: ReactNode
}) {
  const id = useId()
  const [draft, setDraft] = useState(props.value)
  // Resets the draft when the value changes from outside (undo, reload).
  const [last, setLast] = useState(props.value)
  if (props.value !== last) {
    setLast(props.value)
    setDraft(props.value)
  }
  const commit = () => {
    if (draft !== props.value) props.onCommit(draft)
  }
  const tooLong = props.maxLengthHint !== undefined && draft.length > props.maxLengthHint
  return (
    <div className="form-row">
      <label htmlFor={id}>{props.label}</label>
      {props.multiline ? (
        <textarea
          id={id}
          value={draft}
          disabled={props.disabled}
          rows={3}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          onBlur={commit}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={draft}
          disabled={props.disabled}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              setDraft(props.value)
            }
          }}
        />
      )}
      {tooLong ? (
        <p className="form-row__warning" role="status">
          {draft.length} caractères : au-delà de {props.maxLengthHint}, peu lisible sur un
          téléphone.
        </p>
      ) : null}
      {props.hint ? <p className="form-row__hint">{props.hint}</p> : null}
    </div>
  )
}

/** Number applied on blur or Enter, clamped to [min, max]. */
export function NumberField(props: {
  label: string
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState(String(props.value))
  const [last, setLast] = useState(props.value)
  if (props.value !== last) {
    setLast(props.value)
    setDraft(String(props.value))
  }
  const commit = () => {
    const parsed = Number.parseFloat(draft.replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      setDraft(String(props.value))
      return
    }
    let value = parsed
    if (props.min !== undefined) value = Math.max(props.min, value)
    if (props.max !== undefined) value = Math.min(props.max, value)
    setDraft(String(value))
    if (value !== props.value) props.onCommit(value)
  }
  return (
    <div className="form-row form-row--inline">
      <label htmlFor={id}>{props.label}</label>
      <span className="form-row__number">
        <input
          id={id}
          type="number"
          value={draft}
          min={props.min}
          max={props.max}
          step={props.step ?? 0.1}
          disabled={props.disabled}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        {props.unit ? <span className="form-row__unit">{props.unit}</span> : null}
      </span>
    </div>
  )
}

export function CheckboxField(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => {
          props.onChange(e.target.checked)
        }}
      />
      {props.label}
    </label>
  )
}

export function SelectField<T extends string>(props: {
  label: string
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="form-row form-row--inline">
      <label htmlFor={id}>{props.label}</label>
      <select
        id={id}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => {
          const option = props.options.find((o) => o.value === e.target.value)
          if (option) props.onChange(option.value)
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
