import { useEffect, useState } from 'react'

const defaultWords = ['People', 'Payroll', 'Progress', 'Clarity', 'Payday']

export function TypingWords({ words = defaultWords }: { words?: string[] }) {
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

  return <span className="inline-flex h-[1.1em] w-[8ch] items-center overflow-hidden align-baseline text-left text-primary" aria-label={target}><span aria-hidden="true" className="whitespace-nowrap">{target.slice(0, length)}</span><span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-px shrink-0 animate-pulse bg-primary" /></span>
}
