import './assets/main.css'
import 'vue-sonner/style.css'

import { createApp } from 'vue'
import { toast } from 'vue-sonner'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// Erro de um componente não pode derrubar o terminal inteiro:
// loga, avisa o operador e mantém o app de pé
app.config.errorHandler = (err, _instance, info) => {
  console.error(`Erro não tratado na interface (${info}):`, err)
  toast.error('Erro inesperado na interface. Pressione F12 para detalhes.')
}

app.use(router).mount('#app')
