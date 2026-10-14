import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PrintReport({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('print-report hidden print:block', className)}>
      <div className="print-report-heading">
        <div>
          <div className="section-kicker">LCC Payroll</div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="print-report-generated">Generated {new Date().toLocaleString('en-PH')}</div>
      </div>
      {children}
    </section>
  )
}
