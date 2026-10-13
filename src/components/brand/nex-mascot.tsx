import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

export function NexMascot({ size = 'md', className, label = 'Nex, your PayNexus assistant' }: { size?: 'sm' | 'md' | 'lg'; className?: string; label?: string }) {
  const [winking, setWinking] = useState(false)
  const timer = useRef<number | null>(null)
  const sizes = { sm: 'h-20 w-20', md: 'h-32 w-32', lg: 'h-44 w-44' }

  function wink() {
    setWinking(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setWinking(false), 720)
  }

  useEffect(() => {
    const interval = window.setInterval(wink, 10_000)
    return () => {
      window.clearInterval(interval)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      onMouseEnter={wink}
      onFocus={wink}
      className={cn('relative shrink-0 outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', sizes[size], className)}
    >
      <img src={publicAsset('nex.png')} alt="" className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-300', winking ? 'opacity-0' : 'opacity-100')} />
      <img src={publicAsset('nex-wink.png')} alt="" className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-300', winking ? 'opacity-100' : 'opacity-0')} />
    </div>
  )
}
