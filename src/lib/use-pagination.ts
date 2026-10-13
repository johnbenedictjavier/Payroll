import { useEffect, useMemo, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const

export function usePagination<T>(items: readonly T[], resetKey = '', initialPageSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [resetKey, pageSize])

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const startIndex = items.length === 0 ? 0 : (page - 1) * pageSize + 1
  const endIndex = Math.min(page * pageSize, items.length)

  function setPageSize(value: number) {
    setPageSizeState(value)
    setPage(1)
  }

  return {
    page,
    pageSize,
    pageCount,
    pageItems,
    startIndex,
    endIndex,
    setPage,
    setPageSize,
  }
}
