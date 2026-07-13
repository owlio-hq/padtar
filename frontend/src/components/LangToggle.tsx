import { Languages } from 'lucide-react'
import { useLabels } from '../i18n/LabelsContext'

export function LangToggle() {
  const { language, toggle } = useLabels()
  return (
    <button onClick={toggle} className="toggle-btn" title="Toggle Gujarati/English labels">
      <Languages size={14} />
      {language === 'gujarati' ? 'ગુજરાતી' : 'English'}
    </button>
  )
}
