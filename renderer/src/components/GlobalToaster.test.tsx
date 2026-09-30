import { act } from 'react'
import { render, screen } from '@testing-library/react'
import { toast } from 'sonner'
import { expect, it } from 'vitest'
import { GlobalToaster } from './GlobalToaster'

it('renders a globally dispatched success message', async () => {
  render(<GlobalToaster />)
  act(() => { toast.success('设置已保存') })
  expect(await screen.findByText('设置已保存')).toBeInTheDocument()
})

it('positions messages below the sticky header', () => {
  render(<GlobalToaster />)
  expect(document.querySelector('[data-sonner-toaster]')).toHaveStyle('--offset-top: 72px')
})
