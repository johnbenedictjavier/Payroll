import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const defaultWords = ['People', 'Payroll', 'Progress', 'Clarity', 'Payday']

export function TypingWords({ words = defaultWords, className }: { words?: string[]; className?: string }) {
  const [wordIndex, setWordIndex] = useState(0)
  const [length, setLength] = useState(0)
  const target = words.length > 0 ? words[wordIndex % words.length] : ''

  useEffect(() => {
    setLength(0)
    const timer = window.setInterval(() => {
      setLength((value) => Math.min(value + 1, target.length))
    }, 72)
    return () => window.clearInterval(timer)
  }, [target])

  useEffect(() => {
    if (words.length < 2) return
    const timer = window.setInterval(() => {
      setWordIndex((value) => (value + 1) % words.length)
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [words.length])

  return <span className={cn('inline-flex h-[1.2em] w-[8ch] items-center overflow-hidden text-left text-primary', className)} aria-label={target}><span aria-hidden="true" className="whitespace-nowrap">{target.slice(0, length)}</span><span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-px shrink-0 animate-pulse bg-current" /></span>
}
