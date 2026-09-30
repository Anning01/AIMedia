type Request = { title: string; initial: string; resolve(value: string | null): void }
const queue: Request[] = []
const listeners = new Set<() => void>()
export const promptStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot() { return queue[0] ?? null },
  finish(value: string | null) { queue.shift()?.resolve(value); listeners.forEach(listener => listener()) },
}
export function promptText(title: string, initial = ''): Promise<string | null> {
  if (!window.desktop) return Promise.resolve(window.prompt(title, initial))
  return new Promise(resolve => { queue.push({ title, initial, resolve }); listeners.forEach(listener => listener()) })
}
