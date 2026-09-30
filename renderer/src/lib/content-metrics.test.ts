import { describe, expect, it } from 'vitest'
import { contentMetrics } from './content-metrics'

describe('contentMetrics', () => {
  it('counts visible characters, images, and videos without HTML tags', () => {
    expect(contentMetrics('<h1>标题</h1><p>正文</p><img src="a"><video src="b"></video>')).toEqual({
      characters: 4, images: 1, videos: 1,
    })
  })
})
