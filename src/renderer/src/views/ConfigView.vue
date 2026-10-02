<script setup lang="ts">
import LabelCard from './config/LabelCard.vue'
import PreviewCard from './config/PreviewCard.vue'
import PrinterCard from './config/PrinterCard.vue'
import ScanCard from './config/ScanCard.vue'
import SystemCard from './config/SystemCard.vue'
import TemplatesCard from './config/TemplatesCard.vue'
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="shrink-0 border-b border-border px-6 py-4">
      <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Terminal · Impressão e bipagem
      </p>
      <h2 class="mt-0.5 font-display text-2xl font-semibold uppercase tracking-wider">
        Configurações
      </h2>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(21rem,26rem)]">
      <!-- Coluna esquerda: cards de configuração (scroll) -->
      <div class="min-h-0 min-w-0 overflow-y-auto p-5">
        <div class="mx-auto flex max-w-2xl flex-col gap-4">
          <PrinterCard />
          <TemplatesCard />
          <LabelCard />
          <ScanCard />
          <SystemCard />
        </div>
      </div>

      <!-- Coluna direita: prévia da etiqueta (fixa) -->
      <aside class="min-h-0 min-w-0 overflow-y-auto border-l border-border bg-blueprint p-5">
        <PreviewCard />
      </aside>
    </div>
  </div>
</template>
