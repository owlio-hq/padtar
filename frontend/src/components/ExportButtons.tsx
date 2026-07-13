import { FileSpreadsheet, FileText } from 'lucide-react'

export function ExportButtons({ excelHref, pdfHref }: { excelHref: string; pdfHref: string }) {
  return (
    <>
      <a href={excelHref} className="btn btn-outline" title="Export to Excel (.xlsx)">
        <FileSpreadsheet size={14} />
        Excel
      </a>
      <a href={pdfHref} className="btn btn-outline" title="Export to PDF">
        <FileText size={14} />
        PDF
      </a>
    </>
  )
}
