<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed } from 'vue'
import NodePingBarStrip from '@/components/NodePingBarStrip.vue'
import { useThreeNetPingDisplay } from '@/composables/useThreeNetPingDisplay'

const props = defineProps<{
  node: NodeData
  metric?: 'latency' | 'loss'
  compact?: boolean
}>()
// Consume the previous public event binding, but bar selection no longer opens a chart dialog.
defineEmits<{ open: [] }>()
const { lines, windowLabel, showBars, plotNow, weightedAt } = useThreeNetPingDisplay(() => props.node.uuid)
const metrics = computed(() => props.metric ? [props.metric] : ['latency', 'loss'] as const)
</script>

<template>
  <div
    class="min-w-0 w-full" :class="metric ? '' : 'grid grid-cols-2 gap-3'"
    role="group" aria-label="三网延迟与丢包" :data-loss-node="node.uuid" :data-loss-clock="plotNow" :data-loss-as-of="weightedAt" @click.stop
  >
    <div v-for="kind in metrics" :key="kind" class="min-w-0" :data-loss-kind="kind">
      <div v-if="!compact" class="mb-2 flex items-center justify-between gap-1 text-[11px] leading-none">
        <span class="font-medium text-foreground/80">{{ kind === 'latency' ? '延迟' : '丢包' }}</span>
        <span v-if="kind === 'latency'" class="text-[9px] text-muted-foreground">{{ windowLabel }}</span>
      </div>
      <div class="flex flex-col" :class="compact ? 'gap-1.5' : 'gap-2.5'">
        <div v-for="line in lines" :key="line.key" class="min-w-0">
          <div class="flex items-center justify-between gap-1 text-[11px] leading-[1.2] tabular-nums">
            <span class="min-w-0 truncate text-muted-foreground" :title="line.name">{{ line.name }}</span>
            <span class="shrink-0 font-medium" :data-loss-carrier="line.key" :data-loss-value="kind === 'latency' ? line.latency : line.loss" :style="{ color: kind === 'latency' ? line.latencyColor : line.lossColor }">
              {{ kind === 'latency' ? line.latencyDisplay : line.lossDisplay }}
            </span>
          </div>
          <div v-if="showBars" class="mt-1">
            <NodePingBarStrip :bars="line.bars" :metric="kind" :name="line.name" :compact="compact" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
