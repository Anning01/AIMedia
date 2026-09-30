import { describe, expect, it } from 'vitest'
import type { TaskMedia } from './api'
import { resolveMediaUrl, withSourceMediaPreviews } from './source-media'

const image: TaskMedia = {
  id: 'img-1', media_type: 'image', status: 'failed', url: null,
  preview_url: 'https://cdn.example/a.jpg?x=1&y=2', poster_url: null,
  alt_text: '天气“图” <测试> " onerror="alert(1)', origin: 'aimaster', error: 'blocked',
  paragraph_index: 1, source_order: 1,
}

describe('source media previews', () => {
  it('resolves local media URLs against the API origin', () => {
    expect(resolveMediaUrl('/api/media/a/content', 'http://localhost:8000'))
      .toBe('http://localhost:8000/api/media/a/content')
  })

  it('adds escaped images and videos to editor HTML', () => {
    const video: TaskMedia = {
      id: 'vid-1', media_type: 'video', status: 'ready',
      url: 'https://video.example/a.mp4', preview_url: 'https://video.example/a.mp4',
      poster_url: 'https://cdn.example/poster.jpg', alt_text: '现场',
      origin: 'aimaster', error: null, paragraph_index: 0, source_order: 0,
    }
    const composed = withSourceMediaPreviews('<p>第一段</p><p>第二段</p>', [image, video], 'http://localhost:8000')
    const document = new DOMParser().parseFromString(composed, 'text/html')

    expect(document.querySelector('img')?.dataset.assetId).toBe('img-1')
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('天气“图” <测试> " onerror="alert(1)')
    expect(document.querySelector('img')?.hasAttribute('onerror')).toBe(false)
    expect(document.querySelector('video')?.getAttribute('poster')).toBe('https://cdn.example/poster.jpg')
    expect(document.querySelectorAll('figure')).toHaveLength(2)
    expect(document.querySelector('img')?.closest('figure')?.querySelector('figcaption')?.textContent)
      .toBe('天气“图” <测试> " onerror="alert(1)')
    const paragraphs = document.querySelectorAll('p')
    expect(paragraphs[0].nextElementSibling?.querySelector('video')).not.toBeNull()
    expect(paragraphs[1].nextElementSibling?.querySelector('img')).not.toBeNull()
  })

  it('keeps crawler DOM order for multiple images after the same paragraph', () => {
    const later = { ...image, id: 'later', preview_url: 'https://cdn.example/later.jpg', source_order: 2, paragraph_index: 0 }
    const earlier = { ...image, id: 'earlier', preview_url: 'https://cdn.example/earlier.jpg', source_order: 1, paragraph_index: 0 }
    const composed = withSourceMediaPreviews('<p>第一段</p><p>第二段</p>', [later, earlier], 'http://localhost:8000')
    const document = new DOMParser().parseFromString(composed, 'text/html')
    const ids = Array.from(document.querySelectorAll('img')).map(node => node.dataset.assetId)
    expect(ids).toEqual(['earlier', 'later'])
    expect(document.querySelector('p')?.nextElementSibling?.querySelector('img')?.dataset.assetId).toBe('earlier')
  })

  it('deduplicates by asset id and normalized URL', () => {
    const byId = withSourceMediaPreviews(
      '<p>正文</p><img data-asset-id="img-1" src="https://other.example/a.jpg">',
      [image],
      'http://localhost:8000',
    )
    expect(new DOMParser().parseFromString(byId, 'text/html').querySelectorAll('img')).toHaveLength(1)

    const byUrl = withSourceMediaPreviews(
      '<p>正文</p><img data-asset-id="different" src="https://cdn.example/a.jpg?x=1&amp;y=2">',
      [image],
      'http://localhost:8000',
    )
    expect(new DOMParser().parseFromString(byUrl, 'text/html').querySelectorAll('img')).toHaveLength(1)
  })
})
