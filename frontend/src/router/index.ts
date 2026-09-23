import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/store/modules/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '综合驾驶舱', icon: 'DataAnalysis' }
      },
      {
        path: 'briefing',
        name: 'Briefing',
        component: () => import('@/views/briefing/index.vue'),
        meta: { title: '运营简报', icon: 'Notebook' }
      },
      {
        path: 'well',
        name: 'Well',
        component: () => import('@/views/well/index.vue'),
        meta: { title: '井位管理', icon: 'Position' }
      },
      {
        path: 'lifecycle',
        name: 'Lifecycle',
        component: () => import('@/views/lifecycle/index.vue'),
        meta: { title: '全生命周期', icon: 'Clock' }
      },
      {
        path: 'drilling',
        name: 'Drilling',
        component: () => import('@/views/drilling/index.vue'),
        meta: { title: '钻井监控', icon: 'Monitor' }
      },
      {
        path: 'production',
        name: 'Production',
        component: () => import('@/views/production/index.vue'),
        meta: { title: '生产运营', icon: 'TrendCharts' }
      },
      {
        path: 'equipment',
        name: 'Equipment',
        component: () => import('@/views/equipment/index.vue'),
        meta: { title: '设备管理', icon: 'Tools' }
      },
      {
        path: 'hse',
        name: 'HSE',
        component: () => import('@/views/hse/index.vue'),
        meta: { title: '安全环保', icon: 'Warning' }
      },
      {
        path: 'report',
        name: 'Report',
        component: () => import('@/views/report/index.vue'),
        meta: { title: '报表分析', icon: 'Document' }
      },
      {
        path: 'system',
        name: 'System',
        redirect: '/system/user',
        meta: { title: '系统管理', icon: 'Setting' },
        children: [
          {
            path: 'user',
            name: 'User',
            component: () => import('@/views/system/user/index.vue'),
            meta: { title: '用户管理' }
          },
          {
            path: 'role',
            name: 'Role',
            component: () => import('@/views/system/role/index.vue'),
            meta: { title: '角色管理' }
          },
          {
            path: 'menu',
            name: 'Menu',
            component: () => import('@/views/system/menu/index.vue'),
            meta: { title: '菜单管理' }
          }
        ]
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  const token = userStore.token
  
  if (to.path !== '/login' && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
