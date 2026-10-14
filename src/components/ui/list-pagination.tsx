import { useId } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PAGE_SIZE_OPTIONS } from '@/lib/use-pagination'

export function ListPagination({
  total,
  start,
  end,
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  start: number
  end: number
  page: number
  pageCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const selectId = useId()
  if (total === 0) return null

  return (
    <div className="mt-4 grid min-w-0 gap-3 border-t border-dashed pt-4 text-xs text-muted-foreground print:hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
        <label htmlFor={selectId} className="whitespace-nowrap font-semibold">Show</label>
        <select
          id={selectId}
          aria-label="Show entries"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-8 rounded-md border bg-background px-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span>entries</span>
        <span className="whitespace-nowrap">Showing {start}-{end} of {total}</span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="whitespace-nowrap font-semibold text-foreground">Page {page} of {pageCount}</span>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
