import type { SnoozeKind } from './useUpdateStatus'

export function SnoozeMenu({ onSnooze, disabled }: { onSnooze: (kind: SnoozeKind) => void; disabled?: boolean }) {
  return (
    <select
      className="btn btn-outline snooze-select"
      value=""
      disabled={disabled}
      aria-label="Remind me later"
      onChange={(e) => {
        const v = e.target.value as SnoozeKind | ''
        if (v) onSnooze(v)
        e.target.value = ''
      }}
    >
      <option value="" disabled>
        Remind me later…
      </option>
      <option value="later">In 4 hours</option>
      <option value="evening">This evening</option>
      <option value="tomorrow">Tomorrow morning</option>
    </select>
  )
}
