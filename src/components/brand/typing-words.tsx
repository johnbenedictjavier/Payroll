import { useEffect, useState } from 'react'

export function TypingWords({ words = ['People', 'Payroll', 'Progress', 'Clarity', 'Payday'] }: { words?: string[] }) {
  const [wordIndex, setWordIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const target = words[wordIndex] ?? words[0] ?? ''

  useEffect(() => {
    const completeDelay = deleting ? 50 : length === target.length ? 1_500 : 82
    const timer = window.setTimeout(() => {
      if (!deleting && length < target.length) {
        setLength((value) => value + 1)
      } else if (!deleting && length === target.length) {
        setDeleting(true)
      } else if (deleting && length > 0) {
        setLength((value) => value - 1)
      } else {
        setDeleting(false)
        setWordIndex((value) => (value + 1) % words.length)
      }
    }, completeDelay)
    return () => window.clearTimeout(timer)
  }, [deleting, length, target.length, wordIndex, words.length])

  return <span className="inline-flex min-w-[7ch] items-center text-primary" aria-label={target}><span aria-hidden="true">{target.slice(0, length)}</span><span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-primary" /></span>
}
