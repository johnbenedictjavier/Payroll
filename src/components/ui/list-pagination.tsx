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
    <div className="mt-4 flex flex-col gap-3 border-t border-dashed pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
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
        <span className="ml-1 hidden sm:inline">Showing {start}-{end} of {total}</span>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="sm:hidden">Showing {start}-{end} of {total}</span>
        <div className="flex items-center gap-1">
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
          <span className="min-w-16 text-center font-semibold text-foreground">{page} / {pageCount}</span>
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
