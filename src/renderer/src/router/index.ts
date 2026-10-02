import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/bipagem' },
    {
      path: '/bipagem',
      name: 'bipagem',
      component: () => import('@/views/BipagemView.vue')
    },
    {
      path: '/dados',
      name: 'dados',
      component: () => import('@/views/DadosView.vue')
    },
    {
      path: '/configuracoes',
      name: 'configuracoes',
      component: () => import('@/views/ConfigView.vue')
    },
    {
      path: '/etiquetas/:id/editar',
      name: 'etiqueta-editor',
      component: () => import('@/views/EtiquetaEditorView.vue')
    }
  ]
})

export default router
