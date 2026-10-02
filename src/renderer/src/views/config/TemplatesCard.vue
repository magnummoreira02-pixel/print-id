<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Copy, Download, FileUp, Pencil, PencilLine, Plus, Trash2 } from '@lucide/vue'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettings } from '@/composables/useSettings'
import { useTemplates } from '@/composables/useTemplates'
import type { LabelTemplate } from '@shared/types'
import ConfigCard from './ConfigCard.vue'

const router = useRouter()
const { state: settingsState } = useSettings()
const templates = useTemplates()

const renaming = ref<LabelTemplate | null>(null)
const renameValue = ref('')
const deleting = ref<LabelTemplate | null>(null)

async function activate(id: string): Promise<void> {
  try {
    await templates.setActive(id)
    toast.success('Modelo ativo alterado. A bipagem imprime com ele.')
  } catch {
    toast.error('Não foi possível alterar o modelo ativo.')
  }
}

function edit(id: string): void {
  void router.push(`/etiquetas/${id}/editar`)
}

async function createNew(): Promise<void> {
  try {
    const created = await templates.create()
    toast.success(`Modelo "${created.name}" criado.`)
    edit(created.id)
  } catch {
    toast.error('Não foi possível criar o modelo.')
  }
}

async function duplicate(id: string): Promise<void> {
  try {
    const copy = await templates.duplicate(id)
    if (copy) toast.success(`Modelo duplicado como "${copy.name}".`)
  } catch {
    toast.error('Não foi possível duplicar o modelo.')
  }
}

function openRename(t: LabelTemplate): void {
  renaming.value = t
  renameValue.value = t.name
}

async function confirmRename(): Promise<void> {
  if (!renaming.value) return
  const name = renameValue.value.trim()
  if (name) {
    try {
      await templates.rename(renaming.value.id, name)
      toast.success('Modelo renomeado.')
    } catch {
      toast.error('Não foi possível renomear o modelo.')
    }
  }
  renaming.value = null
}

async function confirmDelete(): Promise<void> {
  if (!deleting.value) return
  try {
    const removed = await templates.remove(deleting.value.id)
    if (removed) toast.success(`Modelo "${deleting.value.name}" excluído.`)
    else toast.error('É preciso manter ao menos um modelo.')
  } catch {
    toast.error('Não foi possível excluir o modelo.')
  }
  deleting.value = null
}

async function exportTemplate(t: LabelTemplate): Promise<void> {
  const result = await templates.exportToFile(t.id)
  if (result.ok) {
    toast.success(`Modelo exportado para ${result.filePath}`)
  } else if (!result.canceled) {
    toast.error(`Falha ao exportar: ${result.error ?? 'erro desconhecido'}`)
  }
}

async function importTemplate(): Promise<void> {
  const result = await templates.importFromFile()
  if (result.ok && result.added) {
    toast.success(`Modelo "${result.added.name}" importado.`)
  } else if (!result.canceled) {
    toast.error(`Falha ao importar: ${result.error ?? 'arquivo inválido'}`)
  }
}
</script>

<template>
  <ConfigCard title="Modelos de etiqueta">
    <template #action>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          class="text-[10px] uppercase tracking-wider text-muted-foreground"
          @click="importTemplate"
        >
          <FileUp />
          Importar
        </Button>
        <Button
          variant="ghost"
          size="xs"
          class="text-[10px] uppercase tracking-wider text-muted-foreground"
          @click="createNew"
        >
          <Plus />
          Novo
        </Button>
      </div>
    </template>

    <Skeleton v-if="!settingsState.settings" class="h-24 w-full" />

    <div v-else class="flex flex-col gap-1.5">
      <TooltipProvider :delay-duration="300">
        <div
          v-for="t in templates.templates.value"
          :key="t.id"
          class="group flex items-center gap-2 border border-border px-3 py-2 transition-colors"
          :class="
            t.id === templates.activeId.value
              ? 'border-primary/60 bg-accent/40'
              : 'hover:bg-accent/20'
          "
        >
          <button
            type="button"
            class="flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors"
            :class="
              t.id === templates.activeId.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/40 text-transparent hover:border-primary/60'
            "
            :aria-label="`Ativar modelo ${t.name}`"
            @click="activate(t.id)"
          >
            <Check class="size-3" />
          </button>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground">{{ t.name }}</p>
            <p class="font-mono text-[10px] text-muted-foreground">
              {{ t.widthMm }} × {{ t.heightMm }} mm · {{ t.elements.length }} elementos
            </p>
          </div>

          <Badge
            v-if="t.id === templates.activeId.value"
            class="shrink-0 text-[9px] uppercase tracking-wider"
          >
            Ativo
          </Badge>

          <div class="flex shrink-0 items-center gap-0.5 opacity-40 group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon-xs" aria-label="Editar" @click="edit(t.id)">
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar no editor visual</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon-xs" aria-label="Renomear" @click="openRename(t)">
                  <PencilLine />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Renomear</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Duplicar"
                  @click="duplicate(t.id)"
                >
                  <Copy />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Exportar"
                  @click="exportTemplate(t)"
                >
                  <Download />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar para arquivo (.json)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="hover:text-destructive"
                  aria-label="Excluir"
                  :disabled="templates.templates.value.length <= 1"
                  @click="deleting = t"
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      <p class="mt-1 text-[10px] text-muted-foreground">
        O modelo ativo é usado na bipagem, no teste e na prévia. Exporte um modelo para levá-lo a
        outro computador.
      </p>
    </div>

    <!-- Renomear -->
    <Dialog :open="renaming !== null" @update:open="(v) => !v && (renaming = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renomear modelo</DialogTitle>
        </DialogHeader>
        <Input
          v-model="renameValue"
          maxlength="60"
          autofocus
          @keydown.enter.prevent="confirmRename"
        />
        <DialogFooter>
          <Button variant="outline" @click="renaming = null">Cancelar</Button>
          <Button @click="confirmRename">Renomear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Excluir -->
    <Dialog :open="deleting !== null" @update:open="(v) => !v && (deleting = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir modelo</DialogTitle>
          <DialogDescription>
            O modelo "{{ deleting?.name }}" será excluído permanentemente. Exporte antes se quiser
            guardar uma cópia.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleting = null">Cancelar</Button>
          <Button variant="destructive" @click="confirmDelete">Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ConfigCard>
</template>
