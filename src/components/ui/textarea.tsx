import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn('min-h-24 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
