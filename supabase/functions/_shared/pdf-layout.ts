import { PDFFont, PDFPage, rgb } from 'npm:pdf-lib@1.17.1'

export type PdfColumn = {
  label: string
  width: number
  align?: 'left' | 'center' | 'right'
}

export const PDF_COLORS = {
  ink: rgb(0.08, 0.12, 0.2),
  muted: rgb(0.35, 0.4, 0.46),
  primary: rgb(0.06, 0.46, 0.43),
  border: rgb(0.78, 0.82, 0.86),
  header: rgb(0.91, 0.95, 0.96),
  soft: rgb(0.97, 0.98, 0.99),
  white: rgb(1, 1, 1),
}

export const text = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()

export const money = (value: unknown) =>
  `PHP ${Number(value ?? 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export const numberValue = (value: unknown) => Number(value ?? 0) || 0

export function wrapText(value: unknown, font: PDFFont, size: number, width: number, maxLines = 3) {
  const words = text(value).split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > width) {
      if (line) {
        lines.push(line)
        line = ''
      }
      let chunk = ''
      for (const character of word) {
        const candidate = `${chunk}${character}`
        if (font.widthOfTextAtSize(candidate, size) <= width || !chunk) {
          chunk = candidate
        } else {
          lines.push(chunk)
          chunk = character
        }
      }
      line = chunk
      continue
    }
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) {
      line = candidate
      continue
    }
    lines.push(line)
    line = word
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const clipped = lines.slice(0, maxLines)
  let last = clipped[maxLines - 1]
  while (last.length > 3 && font.widthOfTextAtSize(`${last}...`, size) > width) {
    last = last.slice(0, -1)
  }
  clipped[maxLines - 1] = `${last}...`
  return clipped
}

export function columnWidth(columns: PdfColumn[]) {
  return columns.reduce((total, column) => total + column.width, 0)
}

export function rowHeight(columns: PdfColumn[], values: unknown[], font: PDFFont, size = 8, lineHeight = 10) {
  const lineCount = columns.reduce(
    (highest, column, index) => Math.max(highest, wrapText(values[index], font, size, column.width - 10).length),
    1,
  )
  return Math.max(23, lineCount * lineHeight + 8)
}

function drawAlignedText(page: PDFPage, font: PDFFont, value: unknown, x: number, y: number, width: number, size: number, align: PdfColumn['align'], color = PDF_COLORS.ink, maxLines = 3) {
  const lines = wrapText(value, font, size, width - 10, maxLines)
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size)
    const offset = align === 'right' ? width - 5 - lineWidth : align === 'center' ? (width - lineWidth) / 2 : 5
    page.drawText(line, { x: x + Math.max(5, offset), y: y - index * 10, size, font, color })
  })
}

export function drawReportHeader(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, subtitle: string, pageNumber: number, landscape = false) {
  const width = page.getWidth()
  const margin = landscape ? 30 : 42
  page.drawText('LCC PAYROLL', { x: margin, y: page.getHeight() - 42, size: 18, font: bold, color: PDF_COLORS.primary })
  page.drawText(title, { x: margin, y: page.getHeight() - 67, size: 12, font: bold, color: PDF_COLORS.ink })
  page.drawText(text(subtitle), { x: margin, y: page.getHeight() - 84, size: 8, font, color: PDF_COLORS.muted })
  page.drawText(`Page ${pageNumber}`, { x: width - margin - 45, y: page.getHeight() - 42, size: 8, font, color: PDF_COLORS.muted })
  page.drawLine({ start: { x: margin, y: page.getHeight() - 99 }, end: { x: width - margin, y: page.getHeight() - 99 }, thickness: 1.5, color: PDF_COLORS.primary })
  return page.getHeight() - 119
}

export function drawTableHeader(page: PDFPage, bold: PDFFont, columns: PdfColumn[], x: number, y: number, size = 8) {
  const width = columnWidth(columns)
  page.drawRectangle({ x, y: y - 30, width, height: 30, color: PDF_COLORS.header, borderColor: PDF_COLORS.border, borderWidth: 0.6 })
  let cursor = x
  columns.forEach((column) => {
    drawAlignedText(page, bold, column.label, cursor, y - 15, column.width, size, column.align ?? 'left', PDF_COLORS.ink, 2)
    cursor += column.width
  })
  return y - 30
}

export function drawTableRow(page: PDFPage, font: PDFFont, bold: PDFFont, columns: PdfColumn[], values: unknown[], x: number, y: number, options: { size?: number; lineHeight?: number; fill?: boolean; strong?: boolean } = {}) {
  const size = options.size ?? 8
  const lineHeight = options.lineHeight ?? 10
  const height = rowHeight(columns, values, font, size, lineHeight)
  const width = columnWidth(columns)
  page.drawRectangle({ x, y: y - height, width, height, color: options.fill ? PDF_COLORS.soft : PDF_COLORS.white, borderColor: PDF_COLORS.border, borderWidth: 0.5 })
  let cursor = x
  columns.forEach((column, index) => {
    drawAlignedText(page, options.strong ? bold : font, values[index], cursor, y - 14, column.width, size, column.align ?? 'left', PDF_COLORS.ink)
    cursor += column.width
  })
  return y - height
}

export function drawFooter(page: PDFPage, font: PDFFont, note: string, landscape = false) {
  const margin = landscape ? 30 : 42
  page.drawText(text(note), { x: margin, y: 28, size: 7, font, color: PDF_COLORS.muted })
  page.drawText('Confidential payroll document', { x: page.getWidth() - margin - 112, y: 28, size: 7, font, color: PDF_COLORS.muted })
}

export function drawLabelValue(page: PDFPage, font: PDFFont, bold: PDFFont, label: string, value: unknown, x: number, y: number, width: number) {
  page.drawText(label.toUpperCase(), { x, y, size: 7, font: bold, color: PDF_COLORS.muted })
  const lines = wrapText(value, font, 9, width, 2)
  lines.forEach((line, index) => page.drawText(line, { x, y: y - 13 - index * 10, size: 9, font, color: PDF_COLORS.ink }))
}
