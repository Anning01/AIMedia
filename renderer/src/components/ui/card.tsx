import * as React from 'react'
import { cn } from '@/lib/utils'
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card p-5', className)} {...props} /> }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn('text-base font-semibold text-foreground', className)} {...props} /> }
