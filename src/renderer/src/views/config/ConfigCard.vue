<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

defineProps<{
  title: string
}>()
</script>

<template>
  <Card class="gap-0 rounded-lg py-0 shadow-none">
    <div class="flex min-h-9 items-center justify-between gap-2 px-4 py-1.5">
      <h3 class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {{ title }}
      </h3>
      <slot name="action" />
    </div>
    <Separator />
    <CardContent class="px-4 py-4">
      <slot />
    </CardContent>
  </Card>
</template>
