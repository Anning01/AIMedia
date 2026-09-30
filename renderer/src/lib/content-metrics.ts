export type ContentMetrics = { characters: number; images: number; videos: number }

export function contentMetrics(html: string): ContentMetrics {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const text = (document.body.textContent ?? '').replace(/\s/g, '')
  return { characters: [...text].length, images: document.images.length, videos: document.querySelectorAll('video').length }
}
