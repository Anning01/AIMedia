import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!) }
export function formatTime(value?: string) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
export function articleSourceLabel(platform: string) {
  const labels: Record<string, string> = { manual: '手动创建', aimaster: 'AI Master', toutiao: '今日头条', wechat: '微信公众号' }
  return labels[platform] ?? (platform || '未标注来源')
}
