import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { lazy } from 'react'
import { AppShell } from '@/components/AppShell'
const TasksPage = lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })))
const TaskDetailPage = lazy(() => import('@/pages/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })))
const SkillsPage = lazy(() => import('@/pages/SkillsPage').then(m => ({ default: m.SkillsPage })))
const AccountsPage = lazy(() => import('@/pages/AccountsPage').then(m => ({ default: m.AccountsPage })))
const PublishingPage = lazy(() => import('@/pages/PublishingPage').then(m => ({ default: m.PublishingPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const rootRoute=createRootRoute({component:AppShell})
const indexRoute=createRoute({getParentRoute:()=>rootRoute,path:'/',beforeLoad:()=>{throw redirect({to:'/articles'})}})
const articlesRoute=createRoute({getParentRoute:()=>rootRoute,path:'/articles',component:TasksPage})
const articleRoute=createRoute({getParentRoute:()=>rootRoute,path:'/articles/$articleId',component:TaskDetailPage})
const skillsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/skills',component:SkillsPage})
const accountsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/accounts',component:AccountsPage})
const publishingRoute=createRoute({getParentRoute:()=>rootRoute,path:'/publishing',component:PublishingPage})
const settingsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/settings',component:SettingsPage})
const legacyTasksRoute=createRoute({getParentRoute:()=>rootRoute,path:'/tasks',beforeLoad:()=>{throw redirect({to:'/articles'})}})
const legacyTaskRoute=createRoute({getParentRoute:()=>rootRoute,path:'/tasks/$taskId',beforeLoad:({params})=>{throw redirect({to:'/articles/$articleId',params:{articleId:params.taskId}})}})
const legacyPlaygroundRoute=createRoute({getParentRoute:()=>rootRoute,path:'/playground',beforeLoad:()=>{throw redirect({to:'/skills'})}})
const routeTree=rootRoute.addChildren([indexRoute,articlesRoute,articleRoute,skillsRoute,accountsRoute,publishingRoute,settingsRoute,legacyTasksRoute,legacyTaskRoute,legacyPlaygroundRoute])
export const router=createRouter({routeTree})
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
