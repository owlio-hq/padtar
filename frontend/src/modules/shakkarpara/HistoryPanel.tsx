import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Undo2 } from 'lucide-react'
import { shakkarparaApi } from './api'

export function HistoryPanel({ batchId }: { batchId: number }) {
  const queryClient = useQueryClient()
  const { data: history } = useQuery({
    queryKey: ['shakkarpara-history', batchId],
    queryFn: () => shakkarparaApi.history(batchId),
  })

  const undoMutation = useMutation({
    mutationFn: () => shakkarparaApi.undo(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-batch', batchId] })
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-history', batchId] })
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-batches'] })
    },
  })

  if (!history || history.length === 0) return null

  return (
    <div className="card mt-5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Edit history ({history.length}/5)
        </h3>
        <button onClick={() => undoMutation.mutate()} disabled={undoMutation.isPending} className="btn btn-outline btn-sm">
          <Undo2 size={13} />
          {undoMutation.isPending ? 'Undoing…' : 'Undo last change'}
        </button>
      </div>
      <ul className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        {history.map((h) => (
          <li key={h.id}>{new Date(h.snapshot_at).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  )
}
