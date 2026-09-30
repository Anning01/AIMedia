export {}
declare global {
  interface Window {
    desktop?: {
      readonly isDesktop: true
      readonly apiBase: string
      importData(): Promise<{ tasks: number; accounts: number; media: number; missing_media: number } | null>
      openDataDirectory(): Promise<void>
      openBrowserSession(accountId: string, url: string, preserveExisting?: boolean): Promise<void>
      prepareBrowserPublish?(scheduleId: string): Promise<{ status: 'awaiting_approval' | 'needs_handoff'; message: string; scheduleId: string; preview: { account: { name: string; platform: string }; article: { title: string; html: string; image_count: number; version_id: string } } }>
      confirmBrowserPublish?(scheduleId: string): Promise<{ status: 'published' | 'needs_handoff'; message: string; scheduleId: string }>
    }
  }
}
