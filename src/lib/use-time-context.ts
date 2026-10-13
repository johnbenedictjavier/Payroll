import { useEffect, useState } from 'react'
import { formatToday, getTimeGreeting } from '@/lib/utils'

export function useTimeContext() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return { now, greeting: getTimeGreeting(now), today: formatToday(now) }
}
