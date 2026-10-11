import {
  AlignmentType,
  BorderStyle,
  Document as WordDocument,
  HeadingLevel,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx'
import * as mammoth from 'mammoth'
import type {
  CharacterReference,
  Dependent,
  EducationalBackground,
  EmergencyContact,
  EmployeeProfilePayload,
} from '@/types/database'

export const EMPLOYEE_FORM_PARSER_VERSION = 'pms-employee-form-v2'

export type ParsedEmployeeDocument = Omit<EmployeeProfilePayload, 'employee' | 'assignments'> & {
  employee: EmployeeProfilePayload['employee']
  assignments: Array<Partial<EmployeeProfilePayload['assignments'][number]> & { department_name: string; position_name: string; start_date: string }>
  warnings: string[]
}

const tableBorder = { style: BorderStyle.SINGLE, size: 4, color: 'C9D8D8' }
const tableOptions = {
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder, insideHorizontal: tableBorder, insideVertical: tableBorder },
}
const cellMargins = { top: 120, bottom: 120, left: 150, right: 150 }
const labelFill = 'E8F4F0'
const headerFill = '0A2830'

function textRun(text: string, options: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) {
  return new TextRun({ text, bold: options.bold, color: options.color, size: options.size ?? 20, italics: options.italics })
}

function cell(text: string, options: { bold?: boolean; fill?: string; width?: number; color?: string } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    shading: options.fill ? { fill: options.fill } : undefined,
    margins: cellMargins,
    verticalAlign: VerticalAlignTable.CENTER,
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [textRun(text || ' ', { bold: options.bold, color: options.color })] })],
  })
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 280, after: 120 },
    children: [textRun(text, { bold: true, color: '05A878', size: 25 })],
  })
}

function tableHeader(headers: string[], widths: number[]) {
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((header, index) => cell(header, { bold: true, color: 'FFFFFF', fill: headerFill, width: widths[index] })),
  })
}

function blankRows(headers: string[], widths: number[], count: number) {
  return [
    tableHeader(headers, widths),
    ...Array.from({ length: count }, () => new TableRow({
      cantSplit: true,
      height: { value: 520, rule: HeightRule.ATLEAST },
      children: headers.map((_, index) => cell('', { width: widths[index] })),
    })),
  ]
}

function labeledRows(labels: string[], labelWidth = 3200, valueWidth = 7600) {
  return labels.map((label) => new TableRow({
    cantSplit: true,
    children: [cell(label, { bold: true, fill: labelFill, width: labelWidth }), cell('', { width: valueWidth })],
  }))
}

async function loadLogo() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}pms.png`)
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

export async function downloadEmployeeTemplate() {
  const logo = await loadLogo()
  const headerChildren = logo
    ? [new ImageRun({ data: logo, type: 'png', transformation: { width: 150, height: 64 }, altText: { title: 'Paynexus Payroll', description: 'Paynexus Payroll logo', name: 'Paynexus Payroll logo' } })]
    : [textRun('PAYNEXUS', { bold: true, color: '0A2830', size: 34 })]
  const document = new WordDocument({
    creator: 'Paynexus Payroll Management System',
    title: 'PMS Employee Information Form',
    description: `Structured employee information template, parser ${EMPLOYEE_FORM_PARSER_VERSION}.`,
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: headerChildren }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [textRun('EMPLOYEE INFORMATION FORM', { bold: true, color: '05A878', size: 27 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [textRun('Complete the fields below. Salary and government identifiers are managed separately by the administrator.', { color: '52666A', size: 18 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [textRun(`Template version: ${EMPLOYEE_FORM_PARSER_VERSION}`, { color: '718083', italics: true, size: 16 })] }),
        sectionHeading('Personal Information'),
        new Table({ ...tableOptions, rows: labeledRows(['Employee number (assigned by PMS)', 'First name', 'Middle name', 'Last name', 'Gender', 'Email', 'Contact number', 'Civil status', 'Birth date (YYYY-MM-DD)', 'Nationality', 'Religion', 'Permanent address', 'Present address']) }),
        new Paragraph({ spacing: { before: 100, after: 60 }, children: [textRun('Employee number is assigned by the administrator. Do not edit this field.', { italics: true, color: '657580', size: 17 })] }),
        sectionHeading('Emergency Contacts'),
        new Paragraph({ spacing: { after: 70 }, children: [textRun('Add rows by copying a blank row when more contacts are needed.', { color: '52666A', size: 18 })] }),
        new Table({ ...tableOptions, rows: blankRows(['Name', 'Relationship', 'Contact', 'Address'], [2700, 2400, 2400, 2700], 3) }),
        sectionHeading('Dependents'),
        new Table({ ...tableOptions, rows: blankRows(['Name', 'Relationship', 'Birth date (YYYY-MM-DD)'], [4300, 3000, 2900], 3) }),
        sectionHeading('Educational Background'),
        new Table({ ...tableOptions, rows: blankRows(['Level', 'School', 'Address', 'School year'], [2200, 3100, 3300, 1600], 3) }),
        sectionHeading('Character References'),
        new Table({ ...tableOptions, rows: blankRows(['Name', 'Occupation', 'Contact', 'Address'], [2700, 2400, 2400, 2700], 3) }),
        sectionHeading('Employee Position and Assignment'),
        new Paragraph({ spacing: { after: 70 }, children: [textRun('Salary and government identification fields are managed separately by the administrator.', { color: '52666A', size: 18 })] }),
        new Table({ ...tableOptions, rows: blankRows(['Department', 'Position', 'Start date (YYYY-MM-DD)', 'End date (YYYY-MM-DD)'], [2600, 3000, 2600, 2600], 2) }),
        new Paragraph({ spacing: { before: 300, after: 100 }, children: [textRun('Employee acknowledgement', { bold: true, color: '0A2830', size: 20 })] }),
        new Paragraph({ spacing: { after: 100 }, children: [textRun('I confirm that the information above is accurate to the best of my knowledge.', { size: 18 })] }),
        new Table({ ...tableOptions, rows: [new TableRow({ cantSplit: true, children: [cell('Employee signature', { bold: true, fill: labelFill, width: 3200 }), cell('____________________________________________', { width: 7600 })] }), new TableRow({ cantSplit: true, children: [cell('Date signed', { bold: true, fill: labelFill, width: 3200 }), cell('____________________', { width: 7600 })] })] }),
      ],
    }],
  })
  const blob = await Packer.toBlob(document)
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = 'PMS-employee-information-form.docx'
  anchor.style.display = 'none'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function normalize(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function canonical(value: string | null | undefined) {
  return normalize(value).toLowerCase().replace(/[：:]/g, '').replace(/\([^)]*\)/g, '').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeDate(value: string) {
  const clean = normalize(value)
  if (!clean) return ''
  const iso = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  const slash = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  const year = iso ? Number(iso[1]) : slash ? Number(slash[3]) : 0
  const month = iso ? Number(iso[2]) : slash ? Number(slash[1]) : 0
  const day = iso ? Number(iso[3]) : slash ? Number(slash[2]) : 0
  if (year && month && day) {
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  }
  const parsed = new Date(clean)
  return Number.isNaN(parsed.getTime()) ? clean : parsed.toISOString().slice(0, 10)
}

function tableAfterHeading(root: globalThis.Document, title: string) {
  const elements = Array.from(root.body.querySelectorAll('h1,h2,h3,h4,p'))
  const headingElement = elements.find((element) => canonical(element.textContent) === canonical(title))
  if (!headingElement) return null
  let next = headingElement.nextElementSibling
  while (next) {
    if (next instanceof HTMLTableElement) return next
    next = next.nextElementSibling
  }
  return null
}

function tableRows(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => normalize(cell.textContent)))
}

function labeledValue(rows: string[][], label: string) {
  const target = canonical(label)
  const row = rows.find((current) => canonical(current[0]) === target || canonical(current[0]).startsWith(`${target} `))
  return row?.[1] ?? ''
}

function repeatingRows(table: HTMLTableElement | null, headers: string[]) {
  if (!table) return []
  const rows = tableRows(table)
  const firstRow = rows[0] ?? []
  const isHeader = headers.filter((header, index) => canonical(firstRow[index]) === canonical(header)).length >= Math.min(2, headers.length)
  return (isHeader ? rows.slice(1) : rows).filter((row) => row.some((value) => value.length > 0))
}

export async function parseEmployeeDocument(file: File): Promise<ParsedEmployeeDocument> {
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  const parsedDocument = new DOMParser().parseFromString(result.value, 'text/html')
  const warnings = [...result.messages.map((message) => message.message)]
  const personalTable = tableAfterHeading(parsedDocument, 'Personal Information')
  if (!personalTable) warnings.push('Personal Information section was not found.')
  const personalRows = personalTable ? tableRows(personalTable) : []
  const emergencyRows = repeatingRows(tableAfterHeading(parsedDocument, 'Emergency Contacts'), ['Name', 'Relationship', 'Contact', 'Address'])
  const dependentRows = repeatingRows(tableAfterHeading(parsedDocument, 'Dependents'), ['Name', 'Relationship', 'Birth date (YYYY-MM-DD)'])
  const educationRows = repeatingRows(tableAfterHeading(parsedDocument, 'Educational Background'), ['Level', 'School', 'Address', 'School year'])
  const referenceRows = repeatingRows(tableAfterHeading(parsedDocument, 'Character References'), ['Name', 'Occupation', 'Contact', 'Address'])
  const assignmentRows = repeatingRows(tableAfterHeading(parsedDocument, 'Employee Position and Assignment'), ['Department', 'Position', 'Start date (YYYY-MM-DD)', 'End date (YYYY-MM-DD)'])

  const emergency_contacts: EmergencyContact[] = emergencyRows.map((row) => ({ name: row[0] ?? '', relationship: row[1] ?? '', contact: row[2] ?? '', address: row[3] ?? '' }))
  const dependents: Dependent[] = dependentRows.map((row) => ({ name: row[0] ?? '', relationship: row[1] ?? '', birth_date: normalizeDate(row[2] ?? '') }))
  const educational_backgrounds: EducationalBackground[] = educationRows.map((row) => ({ level: row[0] ?? '', school: row[1] ?? '', address: row[2] ?? '', school_year: row[3] ?? '' }))
  const character_references: CharacterReference[] = referenceRows.map((row) => ({ name: row[0] ?? '', occupation: row[1] ?? '', contact: row[2] ?? '', address: row[3] ?? '' }))
  const assignments = assignmentRows.map((row, index) => ({ department_id: '', position_id: '', department_name: row[0] ?? '', position_name: row[1] ?? '', start_date: normalizeDate(row[2] ?? ''), end_date: normalizeDate(row[3] ?? ''), is_primary: index === 0 }))
  const employee = {
    first_name: labeledValue(personalRows, 'First name'),
    middle_name: labeledValue(personalRows, 'Middle name'),
    last_name: labeledValue(personalRows, 'Last name'),
    gender: labeledValue(personalRows, 'Gender'),
    email: labeledValue(personalRows, 'Email'),
    contact_number: labeledValue(personalRows, 'Contact number'),
    civil_status: labeledValue(personalRows, 'Civil status'),
    birth_date: normalizeDate(labeledValue(personalRows, 'Birth date (YYYY-MM-DD)')),
    nationality: labeledValue(personalRows, 'Nationality'),
    religion: labeledValue(personalRows, 'Religion'),
    permanent_address: labeledValue(personalRows, 'Permanent address'),
    present_address: labeledValue(personalRows, 'Present address'),
  }
  if (!employee.first_name) warnings.push('First name was not found in the document.')
  if (!employee.last_name) warnings.push('Last name was not found in the document.')
  if (assignments.some((assignment) => assignment.department_name || assignment.position_name)) warnings.push('Position names were extracted and need to be matched to the current organization catalog.')

  return { employee, emergency_contacts, dependents, educational_backgrounds, character_references, identifiers: [], assignments, salary_history: [], warnings }
}
