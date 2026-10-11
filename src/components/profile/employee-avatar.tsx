import { useEffect, useState } from 'react'
import { getEmployeePhotoUrl } from '@/services/api'
import { cn, initials } from '@/lib/utils'

export function EmployeeAvatar({ photoPath, name, className, alt = '' }: { photoPath?: string | null; name: string; className?: string; alt?: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!photoPath) {
      setPhotoUrl(null)
    } else if (photoPath.startsWith('http')) {
      setPhotoUrl(photoPath)
    } else {
      void getEmployeePhotoUrl(photoPath).then((url) => { if (active) setPhotoUrl(url) }).catch(() => { if (active) setPhotoUrl(null) })
    }
    return () => { active = false }
  }, [photoPath])

  return <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold text-primary', className)}>{photoUrl ? <img src={photoUrl} alt={alt} className="h-full w-full object-cover" /> : initials(name)}</div>
}
