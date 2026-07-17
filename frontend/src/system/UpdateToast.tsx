import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import type { UseUpdateStatus } from './useUpdateStatus'

const SHOWN_KEY = 'padtar.update.toastShownFor'
const AUTO_DISMISS_MS = 5000

/** Top-right popup that announces a newly-available update once, then goes
 * away on its own after 5s. The sidebar item + Notifications page stay as the
 * persistent way to act on it — this is just the "heads up" moment. */
export function UpdateToast({ u }: { u: UseUpdateStatus }) {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const version = u.status?.version
    if (!u.status?.available || !version) return
    if (sessionStorage.getItem(SHOWN_KEY) === version) return
    sessionStorage.setItem(SHOWN_KEY, version)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [u.status?.available, u.status?.version])

  if (!visible || !u.status) return null

  return (
    <div className="update-toast" role="status">
      <Download size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <div
        className="update-toast-body"
        onClick={() => {
          setVisible(false)
          navigate('/notifications')
        }}
      >
        <div className="update-toast-title">Update available</div>
        <div className="update-toast-text">Version {u.status.version} is ready to install.</div>
      </div>
      <button className="update-toast-close" onClick={() => setVisible(false)} aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  )
}
