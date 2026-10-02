<script setup lang="ts">
import { computed } from 'vue'
import { Printer, ScanLine, Trash2 } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ScanEntry } from './types'

const props = defineProps<{ entries: ScanEntry[] }>()

const emit = defineEmits<{ (e: 'clear'): void }>()

const stats = computed(() => {
  let found = 0
  let notFound = 0
  let labels = 0
  for (const entry of props.entries) {
    if (entry.found) found++
    else notFound++
    labels += entry.labels
  }
  return { total: props.entries.length, found, notFound, labels }
})
</script>

<template>
  <aside class="flex w-80 shrink-0 flex-col border-l border-border bg-card/40">
    <!-- Cabeçalho -->
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
      <p class="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        Histórico da sessão
      </p>
      <Button
        variant="ghost"
        size="xs"
        class="text-muted-foreground hover:text-destructive"
        :disabled="entries.length === 0"
        @click="emit('clear')"
      >
        <Trash2 />
        Limpar
      </Button>
    </div>

    <!-- Contadores -->
    <div class="grid shrink-0 grid-cols-2 border-b border-border">
      <div class="border-b border-r border-border px-4 py-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Bips
        </p>
        <p class="font-mono text-2xl font-bold leading-tight text-foreground">
          {{ stats.total }}
        </p>
      </div>
      <div class="border-b border-border px-4 py-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Encontrados
        </p>
        <p class="font-mono text-2xl font-bold leading-tight text-success">
          {{ stats.found }}
        </p>
      </div>
      <div class="border-r border-border px-4 py-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Não encontrados
        </p>
        <p class="font-mono text-2xl font-bold leading-tight text-destructive">
          {{ stats.notFound }}
        </p>
      </div>
      <div class="px-4 py-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Etiquetas
        </p>
        <p class="font-mono text-2xl font-bold leading-tight text-primary">
          {{ stats.labels }}
        </p>
      </div>
    </div>

    <!-- Lista -->
    <div
      v-if="entries.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <ScanLine class="size-8 text-muted-foreground/40" />
      <p class="text-xs text-muted-foreground">Nenhum bip nesta sessão</p>
    </div>

    <ScrollArea v-else class="min-h-0 flex-1">
      <div v-for="entry in entries" :key="entry.id" class="border-b border-border/60 px-4 py-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[11px] text-muted-foreground">{{ entry.time }}</span>
          <Badge
            v-if="entry.found"
            variant="outline"
            class="rounded-sm border-success/40 bg-success/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-success"
          >
            Encontrado
          </Badge>
          <Badge
            v-else
            variant="outline"
            class="rounded-sm border-destructive/40 bg-destructive/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-destructive"
          >
            Não encontrado
          </Badge>
        </div>
        <div class="mt-0.5 flex items-baseline justify-between gap-2">
          <span class="truncate font-mono text-lg font-semibold text-foreground">
            {{ entry.code }}
          </span>
          <span
            v-if="entry.found && entry.labels > 0"
            class="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
          >
            <Printer class="size-3" />
            <span class="font-mono">{{ entry.labels }}</span>
            {{ entry.labels === 1 ? 'etiqueta' : 'etiquetas' }}
          </span>
        </div>
        <p v-if="entry.error" class="mt-1 text-[11px] leading-snug text-destructive">
          {{ entry.error }}
        </p>
      </div>
    </ScrollArea>
  </aside>
</template>
