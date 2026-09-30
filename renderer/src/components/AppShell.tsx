import * as Dialog from '@radix-ui/react-dialog'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BookOpenText, ChevronRight, Github, LifeBuoy, Menu, Monitor, PanelLeftClose, PanelLeftOpen, Send, Settings, Sparkles, UsersRound, X } from 'lucide-react'
import { Suspense, useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUnsavedDraftWarning } from '@/lib/article-draft'
import { Button } from './ui/button'
import { LoadingState } from './ui/loading'
import { ThemeToggle } from './ThemeToggle'

const navigation = [
  ['/articles', '文章', BookOpenText], ['/skills', 'Skills', Sparkles],
  ['/accounts', '账号管理', UsersRound], ['/publishing', '发布记录', Send], ['/settings', '设置', Settings],
] as const

function StudioBrand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?(): void }) {
  return <Link to="/articles" onClick={onNavigate} className={cn('studio-brand', compact && 'studio-brand--compact')} aria-label="AI Media 首页">
    <span className="studio-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 17.5V6.5A1.5 1.5 0 0 1 6.5 5H14v12.5A1.5 1.5 0 0 1 12.5 19H6.5A1.5 1.5 0 0 1 5 17.5Z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 8h3.5A1.5 1.5 0 0 1 19 9.5v8a1.5 1.5 0 0 1-1.5 1.5H12M8 9h3M8 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
    </span>
    {!compact && <span className="studio-brand-name">AI Media<span>STUDIO</span></span>}
  </Link>
}

export function AppShell() {
  useUnsavedDraftWarning()
  const pathname = useRouterState({ select: s => s.location.pathname })
  const workspace = /^\/articles\/[^/]+\/?$/.test(pathname)
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const compact = workspace && !expanded
  const activeNavigation = navigation.find(([to]) => pathname.startsWith(to))
  const config = useQuery({ queryKey: ['config'], queryFn: () => api<Record<string, string>>('/api/admin/config') })
  const version = useQuery({ queryKey: ['version'], queryFn: () => api<{ update_available: boolean; latest_version?: string }>('/api/system/version'), staleTime: 6 * 60 * 60 * 1000 })

  const nav = (iconsOnly = false) => navigation.map(([to, label, Icon]) => <Link
    key={to} to={to} aria-label={label} aria-current={pathname.startsWith(to) ? 'page' : undefined}
    title={iconsOnly ? label : undefined} onClick={() => setMenuOpen(false)}
    className={cn('studio-nav', iconsOnly && 'studio-nav--compact')}
  ><Icon size={18} aria-hidden="true"/>{!iconsOnly && <><span>{label}</span>{pathname.startsWith(to) && <span className="studio-nav-dot" aria-hidden="true"/>}</>}</Link>)

  return <div className={cn('studio-shell min-h-screen bg-background text-foreground', compact && 'studio-shell--compact', workspace && 'workspace-shell')}>
    <aside className="studio-sidebar">
      <StudioBrand compact={compact}/>
      <nav aria-label="主导航" className="studio-navigation">{nav(compact)}</nav>
      {workspace && <Button variant="ghost" className="studio-collapse" aria-label={compact ? '展开导航' : '收起导航'} title={compact ? '展开导航' : '收起导航'} onClick={() => setExpanded(!expanded)}>{compact ? <PanelLeftOpen size={18}/> : <><PanelLeftClose size={18}/>收起导航</>}</Button>}
      <div className="studio-sidebar-footer">
        <Dialog.Root>
          <Dialog.Trigger asChild><button aria-label="帮助与支持" title={compact ? '帮助与支持' : undefined} className={cn('studio-support', compact && 'studio-support--compact')}>
            <LifeBuoy size={18} aria-hidden="true"/>{!compact && <><span>帮助与支持</span>{version.data?.update_available ? <span className="h-2 w-2 rounded-full bg-warning" aria-label="有新版本"/> : <ChevronRight size={14} aria-hidden="true"/>}</>}
          </button></Dialog.Trigger>
          <Community config={config.data} version={version.data}/>
        </Dialog.Root>
        {!compact && <div className="studio-device"><span className="studio-device-icon"><Monitor size={17} aria-hidden="true"/></span><div><strong>本机工作空间</strong><p>专注每一次创作</p></div></div>}
      </div>
    </aside>

    <header className="studio-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild><Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="打开导航"><Menu size={20}/></Button></Dialog.Trigger>
          <Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay"/>
            <Dialog.Content className="ui-drawer-left studio-mobile-navigation">
              <Dialog.Title className="sr-only">AI Media 导航</Dialog.Title><Dialog.Description className="sr-only">切换文章、Skills、账号管理、发布记录和设置。</Dialog.Description>
              <StudioBrand onNavigate={() => setMenuOpen(false)}/>
              <Dialog.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-4" aria-label="关闭导航"><X size={18}/></Button></Dialog.Close>
              <p className="studio-nav-caption">工作空间</p><nav aria-label="主导航" className="studio-navigation">{nav()}</nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <nav aria-label="当前位置" className="studio-breadcrumb">
          <span className="studio-breadcrumb-root">工作空间</span><ChevronRight className="studio-breadcrumb-root" size={13} aria-hidden="true"/>
          {workspace ? <><Link to="/articles" aria-label="返回文章">文章</Link><ChevronRight size={13} aria-hidden="true"/><span aria-current="page">编辑工作区</span></> : <span aria-current="page">{activeNavigation?.[1] ?? '工作台'}</span>}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {version.data?.update_available && config.data?.github_repository && <a href={'https://github.com/' + config.data.github_repository + '/releases'} className="hidden rounded-full bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning sm:block">发现 {version.data.latest_version}</a>}
        <span className="studio-topbar-label">AI Media Studio</span><ThemeToggle/>
      </div>
    </header>
    <main className={cn('studio-main min-w-0', workspace ? 'studio-main--workspace' : 'studio-main--page')}>
      <Suspense fallback={<LoadingState className="py-24" label="正在加载页面…"/>}><div key={pathname} className="studio-page h-full min-w-0"><Outlet/></div></Suspense>
    </main>
  </div>
}

function Community({ config, version }: { config?: Record<string, string>; version?: { update_available: boolean; latest_version?: string } }) {
  return <Dialog.Portal><Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay backdrop-blur-sm"/>
    <Dialog.Content className="ui-drawer-right fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-surface p-6 shadow-raised">
      <div className="flex items-center justify-between"><Dialog.Title className="text-lg font-semibold">{config?.community_title || '加入社群'}</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="关闭社群服务"><X size={20}/></Button></Dialog.Close></div>
      <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">获取使用帮助、版本动态与交流支持。</Dialog.Description>
      {config?.community_qr_url && <img src={config.community_qr_url} alt="社群二维码" className="mx-auto mt-8 aspect-square w-56 rounded-2xl bg-muted object-cover p-3"/>}
      <div className="mt-8 space-y-3 rounded-xl bg-surface-subtle p-4 text-sm"><p>{config?.community_contact || '请在设置中配置联系方式'}</p>{config?.github_repository && <a className="flex items-center gap-2 text-primary" href={'https://github.com/' + config.github_repository}><Github size={16}/>{config.github_repository}</a>}{version?.update_available && <p className="text-warning">有新版本 {version.latest_version} 可用</p>}</div>
    </Dialog.Content>
  </Dialog.Portal>
}
