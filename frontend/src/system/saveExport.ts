/**
 * Download an export, letting the worker choose WHERE to save it.
 *
 * Uses the File System Access API (`showSaveFilePicker`) so they get a real
 * "Save As" dialog with a sensible filename. Browsers without it (e.g. Firefox)
 * fall back to a normal download — so this degrades safely whatever the client's
 * default browser is.
 */

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}
type WindowWithPicker = Window & {
  showSaveFilePicker?: (opts?: SaveFilePickerOptions) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
  }>
}

const TYPES: Record<string, { description: string; accept: Record<string, string[]> }> = {
  pdf: { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } },
  xlsx: {
    description: 'Excel workbook',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
  },
}

function fallbackDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function saveExport(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  const blob = await res.blob()

  const ext = filename.split('.').pop() ?? ''
  const picker = (window as WindowWithPicker).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({ suggestedName: filename, types: TYPES[ext] ? [TYPES[ext]] : undefined })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      // user hit Cancel in the Save dialog — do nothing, don't fall back to a download
      if (err instanceof DOMException && err.name === 'AbortError') return
      // any other picker failure: fall through to a normal download
    }
  }
  fallbackDownload(blob, filename)
}
