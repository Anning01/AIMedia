import type { TaskMedia } from '@/lib/api'

export function resolveMediaUrl(value: string, apiBase: string): string {
  try {
    return new URL(value, `${apiBase.replace(/\/$/, '')}/`).href
  } catch {
    return value
  }
}

function mediaNode(document: Document, asset: TaskMedia, source: string, apiBase: string): HTMLElement {
  const figure = document.createElement('figure')
  if (asset.media_type === 'image') {
    const image = document.createElement('img')
    image.src = source
    image.alt = asset.alt_text
    image.dataset.assetId = asset.id
    figure.append(image)
  } else {
    const video = document.createElement('video')
    video.src = source
    video.controls = true
    video.preload = 'metadata'
    video.dataset.assetId = asset.id
    if (asset.poster_url) video.poster = resolveMediaUrl(asset.poster_url, apiBase)
    figure.append(video)
  }
  if (asset.alt_text) {
    const caption = document.createElement('figcaption')
    caption.textContent = asset.alt_text
    figure.append(caption)
  }
  return figure
}

export function withSourceMediaPreviews(html: string, media: TaskMedia[], apiBase: string): string {
  const document = new DOMParser().parseFromString(html || '', 'text/html')
  const paragraphs = Array.from(document.querySelectorAll('p'))
  const existingById = new Map<string, HTMLElement>()
  const existingByUrl = new Map<string, HTMLElement>()
  for (const node of document.querySelectorAll<HTMLElement>('img[src],video[src]')) {
    node.setAttribute('src', resolveMediaUrl(node.getAttribute('src') || '', apiBase))
    const container = node.closest('figure') as HTMLElement | null ?? node
    if (node.dataset.assetId) existingById.set(node.dataset.assetId, container)
    existingByUrl.set(resolveMediaUrl(node.getAttribute('src') || '', apiBase), container)
  }
  const ordered = media
    .map((asset, encounter) => ({ asset, encounter }))
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.asset.source_order)
      const rightValid = Number.isFinite(right.asset.source_order)
      if (leftValid !== rightValid) return leftValid ? -1 : 1
      if (leftValid && rightValid) return Number(left.asset.source_order) - Number(right.asset.source_order)
      return left.encounter - right.encounter
    })
  const paragraphTails = new Map<number, HTMLElement>()

  for (const { asset } of ordered) {
    if (!asset.preview_url || (asset.media_type !== 'image' && asset.media_type !== 'video')) continue
    const source = resolveMediaUrl(asset.preview_url, apiBase)
    const existing = existingById.get(asset.id) ?? existingByUrl.get(source)
    const node = existing ?? mediaNode(document, asset, source, apiBase)
    const position = Number.isInteger(asset.paragraph_index) ? Number(asset.paragraph_index) : null
    if (asset.origin === 'aimaster' && position !== null && paragraphs.length) {
      const resolved = Math.min(Math.max(position, 0), paragraphs.length - 1)
      const anchor = paragraphTails.get(resolved) ?? paragraphs[resolved]
      anchor.after(node)
      paragraphTails.set(resolved, node)
    } else if (!existing) {
      document.body.append(node)
    }
    existingById.set(asset.id, node)
    existingByUrl.set(source, node)
  }
  return document.body.innerHTML
}
