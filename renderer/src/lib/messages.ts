import { toast } from 'sonner'

export type MessageId = string | number
export type MessageCopy = { loading: string; success: string }

export type MessageAdapter = {
  loading(text: string): MessageId
  success(text: string, id?: MessageId): void
  error(text: string, id?: MessageId): void
  info(text: string): void
}

export type MessageClient = MessageAdapter & {
  promise<T>(operation: Promise<T>, copy: MessageCopy): Promise<T>
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : '操作失败，请稍后重试'
}

export function createMessages(adapter: MessageAdapter): MessageClient {
  return {
    ...adapter,
    async promise<T>(operation: Promise<T>, copy: MessageCopy) {
      const id = adapter.loading(copy.loading)
      try {
        const result = await operation
        adapter.success(copy.success, id)
        return result
      } catch (error) {
        adapter.error(getErrorMessage(error), id)
        throw error
      }
    },
  }
}

export const messages = createMessages({
  loading: text => toast.loading(text),
  success: (text, id) => { toast.success(text, { id }) },
  error: (text, id) => { toast.error(text, { id, duration: 6000 }) },
  info: text => { toast.info(text) },
})
