import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { promptStore } from '@/lib/prompt'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function InputDialog() {
  const request = useSyncExternalStore(promptStore.subscribe, promptStore.snapshot)
  const [value, setValue] = useState('')
  useEffect(() => { setValue(request?.initial ?? '') }, [request])
  return <Dialog.Root open={Boolean(request)} onOpenChange={open => { if (!open) promptStore.finish(null) }}>
    <Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-[70] bg-overlay backdrop-blur-sm"/>
      <Dialog.Content inert={!request} aria-hidden={!request || undefined} className="ui-dialog-center fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-surface p-6">
        <Dialog.Title className="text-lg font-semibold">{request?.title}</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">填写后点击确定，按 Esc 可取消。</Dialog.Description>
        <form className="mt-5 space-y-5" onSubmit={event => { event.preventDefault(); promptStore.finish(value) }}>
          <Input aria-label={request?.title} value={value} onChange={event => setValue(event.target.value)} autoFocus/>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={!request} onClick={() => promptStore.finish(null)}>取消</Button><Button type="submit" disabled={!request || !value.trim()}>确定</Button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
