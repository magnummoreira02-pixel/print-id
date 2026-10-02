<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ExternalLink, Trash2, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { AppInfo } from '@shared/types'
import ConfigCard from './ConfigCard.vue'

const info = ref<AppInfo | null>(null)
const loading = ref(true)
const resetDialogOpen = ref(false)
const resetting = ref(false)
const uninstallDialogOpen = ref(false)

onMounted(async () => {
  try {
    info.value = await window.api.appInfo()
  } catch {
    toast.error('Não foi possível obter as informações do sistema.')
  } finally {
    loading.value = false
  }
})

async function confirmUninstall(): Promise<void> {
  const started = await window.api.uninstallApp()
  if (!started) {
    uninstallDialogOpen.value = false
    toast.error('Desinstalador não encontrado. Use "Adicionar ou remover programas" do Windows.')
  }
  // se iniciou, o app fecha sozinho e o desinstalador assume
}

async function confirmReset(): Promise<void> {
  if (resetting.value) return
  resetting.value = true
  try {
    // preferências locais do renderer (tema etc.) também voltam ao padrão
    localStorage.clear()
    await window.api.resetApp()
    // o app reinicia sozinho; se chegar aqui, algo impediu
  } catch {
    resetting.value = false
    resetDialogOpen.value = false
    toast.error('Não foi possível resetar o aplicativo.')
  }
}
</script>

<template>
  <ConfigCard title="Sistema">
    <Skeleton v-if="loading" class="h-16 w-full" />

    <div v-else-if="info" class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between gap-3">
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Versão
        </span>
        <span class="font-mono text-xs text-foreground/80">v{{ info.version }}</span>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Armazenamento
        </span>
        <Badge variant="outline" class="rounded-sm font-mono text-[10px] uppercase tracking-wider">
          {{ info.storageBackend }}
        </Badge>
      </div>

      <div class="flex min-w-0 items-center justify-between gap-3">
        <span
          class="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Dados
        </span>
        <TooltipProvider :delay-duration="150">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
                {{ info.dataPath }}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" class="max-w-105 break-all font-mono text-[10px]">
              {{ info.dataPath }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator />

      <!-- Créditos -->
      <div class="flex items-center justify-between gap-3">
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Desenvolvido por
        </span>
        <a
          href="https://github.com/victoralbino"
          target="_blank"
          rel="noreferrer"
          class="group flex items-center gap-1.5 font-mono text-xs text-foreground/80 transition-colors hover:text-primary"
          title="github.com/victoralbino"
        >
          victoralbino
          <ExternalLink class="size-3 opacity-50 group-hover:opacity-100" />
        </a>
      </div>

      <Separator />

      <!-- Zona de perigo -->
      <div class="flex flex-col gap-2">
        <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">
          Zona de perigo
        </p>
        <div class="flex items-center justify-between gap-3">
          <p class="min-w-0 text-[10px] text-muted-foreground">
            Apaga matriz, modelos e configurações.
          </p>
          <Button
            variant="outline"
            size="sm"
            class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            @click="resetDialogOpen = true"
          >
            <TriangleAlert />
            Resetar aplicativo
          </Button>
        </div>
        <div v-if="info.canUninstall" class="flex items-center justify-between gap-3">
          <p class="min-w-0 text-[10px] text-muted-foreground">
            Remove o Print ID deste computador.
          </p>
          <Button
            variant="outline"
            size="sm"
            class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            @click="uninstallDialogOpen = true"
          >
            <Trash2 />
            Desinstalar
          </Button>
        </div>
      </div>
    </div>

    <p v-else class="text-xs text-muted-foreground">Informações indisponíveis.</p>

    <!-- Confirmação da desinstalação -->
    <Dialog :open="uninstallDialogOpen" @update:open="(v) => (uninstallDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="text-destructive">Desinstalar o Print ID?</DialogTitle>
          <DialogDescription>
            O aplicativo será fechado e o desinstalador do Windows será aberto para remover o
            programa. Os dados (matriz, modelos e configurações) permanecem no computador — se
            quiser apagá-los também, use "Resetar aplicativo" antes de desinstalar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="uninstallDialogOpen = false">Cancelar</Button>
          <Button variant="destructive" @click="confirmUninstall">Fechar e desinstalar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Confirmação do reset -->
    <Dialog :open="resetDialogOpen" @update:open="(v) => !resetting && (resetDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="text-destructive">Resetar o aplicativo?</DialogTitle>
          <DialogDescription>
            Isso apaga permanentemente a matriz importada (incluindo edições), todos os modelos de
            etiqueta e as configurações de impressora, e reinicia o Print ID do zero. Se quiser
            guardar seus modelos, exporte-os antes. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="resetting" @click="resetDialogOpen = false">
            Cancelar
          </Button>
          <Button variant="destructive" :disabled="resetting" @click="confirmReset">
            <Spinner v-if="resetting" />
            {{ resetting ? 'Resetando...' : 'Apagar tudo e reiniciar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ConfigCard>
</template>
