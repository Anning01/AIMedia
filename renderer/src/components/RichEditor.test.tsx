import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RichEditor } from './RichEditor'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RichEditor media controls', () => {
  it('keeps format controls in sync with the selection, including undo', async () => {
    const onChange = vi.fn()
    const { container } = render(<RichEditor value="<p>正文</p>" onChange={onChange}/>)
    const heading = await screen.findByRole('button', { name: '标题' })
    const content = container.querySelector('.tiptap')
    expect(heading).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '撤销' })).toBeDisabled()

    fireEvent.click(heading)
    await waitFor(() => expect(heading).toHaveAttribute('aria-pressed', 'true'))
    expect(content?.querySelector('h1')).toHaveTextContent('正文')
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('<h1>正文</h1>'))
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => expect(heading).toHaveAttribute('aria-pressed', 'false'))
    expect(content?.querySelector('p')).toHaveTextContent('正文')
    expect(container.querySelector('.tiptap')).toBe(content)
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled()
  })

  it('renders existing image and video content', async () => {
    const { container } = render(
      <RichEditor
        value={'<p>正文</p><figure><img src="https://cdn.example/image.png" alt="配图"><figcaption>配图</figcaption></figure><figure><video controls src="https://cdn.example/video.mp4"></video><figcaption>视频</figcaption></figure>'}
        onChange={() => undefined}
      />,
    )

    expect(await screen.findByText('正文')).toBeInTheDocument()
    expect(container.querySelector('.tiptap img')).toHaveAttribute('src', 'https://cdn.example/image.png')
    expect(container.querySelector('.tiptap video')).toHaveAttribute('src', 'https://cdn.example/video.mp4')
    expect(screen.getByText(/1 图 · 1 视频/)).toBeInTheDocument()
  })

  it('offers a video URL control and inserts a video node', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('https://cdn.example/new-video.mp4')
    const onChange = vi.fn()
    const { container } = render(<RichEditor value="<p>正文</p>" onChange={onChange} />)

    fireEvent.click(await screen.findByRole('button', { name: '视频' }))

    await waitFor(() => expect(container.querySelector('.tiptap video')).toHaveAttribute('src', 'https://cdn.example/new-video.mp4'))
    expect(onChange).toHaveBeenCalled()
  })
})
