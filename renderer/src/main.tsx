import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { GlobalToaster } from './components/GlobalToaster'
import { InputDialog } from './components/InputDialog'
import { router } from './router'
import './styles.css'
import { initializeTheme } from './lib/theme'
initializeTheme()
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router}/>
      <GlobalToaster/>
      <InputDialog/>
    </QueryClientProvider>
  </React.StrictMode>,
)
