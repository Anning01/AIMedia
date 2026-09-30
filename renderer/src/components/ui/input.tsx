import * as React from 'react'
import { cn } from '@/lib/utils'
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn('ui-input h-11 w-full px-3 text-sm', className)} {...props} />)
Input.displayName = 'Input'
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn('ui-input min-h-28 w-full px-3 py-2 text-sm', className)} {...props} />)
Textarea.displayName = 'Textarea'
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => <select ref={ref} className={cn('ui-input h-11 w-full px-3 text-sm', className)} {...props}/>)
Select.displayName = 'Select'
