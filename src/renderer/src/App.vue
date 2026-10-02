<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { Database, HardDrive, Moon, ScanBarcode, Settings2, Sun, Table2 } from '@lucide/vue'
import { Toaster } from '@/components/ui/sonner'
import { Kbd } from '@/components/ui/kbd'
import { useMatrix } from '@/composables/useMatrix'
import { useSettings } from '@/composables/useSettings'
import type { AppInfo } from '@shared/types'

const router = useRouter()
const { state: matrix, refresh } = useMatrix()
const { load: loadSettings } = useSettings()
const appInfo = ref<AppInfo | null>(null)

const theme = useLocalStorage<'dark' | 'light'>('print-id-theme', 'dark')
const isDark = computed(() => theme.value === 'dark')

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
})

function toggleTheme(): void {
  theme.value = isDark.value ? 'light' : 'dark'
}

const navItems = [
  { to: '/bipagem', label: 'Bipagem', icon: ScanBarcode, key: 'F1' },
  { to: '/dados', label: 'Dados', icon: Table2, key: 'F2' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings2, key: 'F3' }
]

function onKeydown(e: KeyboardEvent): void {
  const item = navItems.find((n) => n.key === e.key)
  if (item) {
    e.preventDefault()
    router.push(item.to)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await Promise.all([refresh(), loadSettings()])
  appInfo.value = await window.api.appInfo()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flex h-full">
    <!-- Trilho lateral -->
    <aside class="flex w-52 shrink-0 flex-col border-r border-border bg-card/60">
      <div class="border-b border-border px-4 py-4">
        <h1 class="font-display text-xl font-bold tracking-widest text-foreground">
          PRINT<span class="text-primary"> ID</span>
        </h1>
        <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Etiquetas
        </p>
      </div>

      <nav class="flex flex-1 flex-col gap-1 p-2">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          active-class="!border-primary bg-accent/60 !text-primary"
        >
          <component :is="item.icon" class="size-4 shrink-0" />
          <span class="flex-1 uppercase tracking-wider text-xs font-semibold">{{
            item.label
          }}</span>
          <Kbd class="text-[9px] opacity-50 group-hover:opacity-100">{{ item.key }}</Kbd>
        </RouterLink>
      </nav>

      <div class="border-t border-border p-2">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" class="size-4 shrink-0" />
          <Moon v-else class="size-4 shrink-0" />
          {{ isDark ? 'Modo claro' : 'Modo escuro' }}
        </button>
      </div>

      <div class="border-t border-border p-3 text-[10px] text-muted-foreground">
        <div class="flex items-center gap-2">
          <Database class="size-3 shrink-0" />
          <span v-if="matrix.payload" class="truncate font-mono">
            {{ matrix.payload.meta.rowCount.toLocaleString('pt-BR') }} linhas
          </span>
          <span v-else>Sem matriz</span>
        </div>
        <div v-if="appInfo" class="mt-1 flex items-center gap-2">
          <HardDrive class="size-3 shrink-0" />
          <span class="font-mono uppercase">{{ appInfo.storageBackend }}</span>
          <span class="ml-auto font-mono">v{{ appInfo.version }}</span>
        </div>
      </div>
    </aside>

    <!-- Conteúdo: KeepAlive preserva o histórico da bipagem e os filtros
         da tabela ao navegar entre telas -->
    <main class="min-w-0 flex-1 overflow-hidden">
      <RouterView v-slot="{ Component }">
        <KeepAlive exclude="EtiquetaEditorView">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
  </div>

  <Toaster :theme="isDark ? 'dark' : 'light'" position="bottom-right" rich-colors close-button />
</template>
