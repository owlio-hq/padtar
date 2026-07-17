/**
 * The one sheet currently open for editing (batch or day).
 *
 * Only one can be open at a time, so a tiny module-level registry is enough.
 * The update flow uses this to save the worker's in-progress sheet before
 * restarting the app — losing a half-entered day would be unacceptable.
 */
export interface OpenSheet {
  /** Unsaved edits right now? */
  dirty: () => boolean
  /** Save them. Rejects if the save fails (e.g. duplicate date). */
  save: () => Promise<void>
}

let current: OpenSheet | null = null

export function setOpenSheet(sheet: OpenSheet | null): void {
  current = sheet
}

export function sheetHasUnsavedWork(): boolean {
  try {
    return !!current?.dirty()
  } catch {
    return false
  }
}

/** Save the open sheet if it has unsaved edits. Rejects if the save fails. */
export async function saveOpenSheet(): Promise<void> {
  if (current?.dirty()) await current.save()
}
