/// <reference types="node" />
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { Button } from './button'
import { Input, Select } from './input'
import { LoadingState, Skeleton } from './loading'
import { Badge } from './badge'

const css = readFileSync('src/styles.css', 'utf8')
const luminance = (hex: string) => {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi)!.map(value => {
    const channel = parseInt(value, 16) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
  return .2126 * r + .7152 * g + .0722 * b
}

describe('Studio component foundations', () => {
  it('keeps application colors semantic instead of restoring page-specific palettes', () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.tsx') && !file.includes('.test.'))
    for (const file of files) {
      const source = readFileSync(`src/${file}`, 'utf8')
      expect(source, file).not.toMatch(/(?:bg|text|border|ring|decoration)-(?:slate|teal|rose|sky|blue|violet|emerald|amber|orange|red)-\d|(?:bg|text|border)-\[#[\da-f]+\]|dark:(?:bg|text|border|ring|shadow)-/i)
    }
  })

  it('shares semantic badge tones without losing their distinct status labels', () => {
    render(<><Badge value="completed"/><Badge value="published"/><Badge value="needs_handoff"/><Badge value="unknown"/></>)
    expect(screen.getByText('已完成')).toHaveAttribute('data-tone', 'success')
    expect(screen.getByText('已发布')).toHaveAttribute('data-tone', 'success')
    expect(screen.getByText('需要人工接管')).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByText('unknown')).toHaveAttribute('data-tone', 'neutral')
  })
  it('announces one loading message and hides decorative blocks and skeletons', () => {
    const { container } = render(<><LoadingState label="正在读取文章…"/><Skeleton/></>)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('正在读取文章…')
    expect(container.querySelector('.ui-loader')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.ui-skeleton')).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps native disabled and input error semantics', () => {
    const click = vi.fn()
    render(<><Button disabled onClick={click}>保存</Button><Input aria-label="标题" aria-invalid="true"/><Select aria-label="平台" disabled><option>公众号</option></Select></>)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(click).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByRole('combobox')).toHaveClass('ui-input')
  })

  for (const selector of [':root', ':root.dark']) {
    it(`${selector} tokens match design.md and maintain intended contrast pairs`, () => {
      const body = css.split(`${selector} {`)[1].split('}')[0]
      const tokens = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(match => [match[1], match[2].toUpperCase()]))
      const spec = readFileSync('../design.md', 'utf8')
      for (const color of Object.values(tokens)) expect(spec).toContain(color)
      const pairs: [string, string, number][] = [
        ['foreground', 'background', 4.5], ['foreground', 'surface', 4.5],
        ['muted-foreground', 'muted', 4.5], ['muted-foreground', 'surface', 4.5],
        ['primary-foreground', 'primary', 4.5], ['primary-foreground', 'primary-hover', 4.5],
        ['accent-foreground', 'accent', 4.5], ['input-border', 'surface', 3],
        ...['success', 'warning', 'danger', 'info'].map(tone => [tone, `${tone}-soft`, 4.5] as [string, string, number]),
      ]
      for (const [text, background, minimum] of pairs) {
        const values = [luminance(tokens[text]), luminance(tokens[background])].sort((a,b) => b-a)
        expect((values[0]+.05)/(values[1]+.05), `${text}/${background}`).toBeGreaterThanOrEqual(minimum)
      }
    })
  }

  it('defines reduced-motion fallback after looping loader styles', () => {
    expect(css.indexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(css.indexOf('@keyframes studio-loading'))
    expect(css).toContain('animation-iteration-count: 1 !important')
  })

  it('uses the documented motion tokens for pages, panels, dialogs and drawers', () => {
    expect(css).toContain('.studio-page { animation: studio-page-in var(--motion-normal) var(--ease-out); }')
    expect(css).toContain('.studio-tab-panel:not([hidden]) { animation: studio-panel-in var(--motion-fast) var(--ease-out); }')
    expect(css).toContain('.ui-dialog-center[data-state="open"] { animation: studio-dialog-in var(--motion-normal) var(--ease-out); }')
    expect(css).toContain('.ui-drawer-left[data-state="open"] { animation: studio-left-in var(--motion-normal) var(--ease-out); }')
    expect(css).not.toMatch(/transition:\s*all/)
  })
})
