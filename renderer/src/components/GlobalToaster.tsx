import { Toaster } from 'sonner'

export function GlobalToaster() {
  return <Toaster
    position="top-right"
    visibleToasts={4}
    closeButton
    gap={10}
    offset={{ top: 72, right: 24, bottom: 24, left: 24 }}
    mobileOffset={{ top: 72, right: 16, bottom: 16, left: 16 }}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: 'group flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-2xl bg-surface p-4 text-sm text-foreground shadow-raised backdrop-blur',
        title: 'font-medium leading-5',
        description: 'text-xs text-muted-foreground',
        closeButton: 'border-0 bg-muted text-muted-foreground hover:bg-muted',
        success: 'text-success',
        error: 'text-danger',
        info: 'text-info',
        loading: 'text-foreground',
      },
    }}
  />
}
