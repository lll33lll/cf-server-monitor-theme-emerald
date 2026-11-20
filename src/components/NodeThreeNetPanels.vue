<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed } from 'vue'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { useThreeNetPingDisplay } from '@/composables/useThreeNetPingDisplay'

const props = defineProps<{
  node: NodeData
  metric?: 'latency' | 'loss'
  compact?: boolean
}>()
const emit = defineEmits<{ open: [] }>()
const { lines, windowLabel, showBars } = useThreeNetPingDisplay(() => props.node.uuid)
const metrics = computed(() => props.metric ? [props.metric] : ['latency', 'loss'] as const)
</script>

<template>
  <div class="min-w-0 w-full" :class="metric ? '' : 'grid grid-cols-2 gap-3'">
    <div v-for="kind in metrics" :key="kind" class="min-w-0">
      <div v-if="!compact" class="mb-2 flex items-center justify-between gap-1 text-[11px] leading-none">
        <span class="font-medium text-foreground/80">{{ kind === 'latency' ? '延迟' : '丢包' }}</span>
        <span v-if="kind === 'latency'" class="text-[9px] text-muted-foreground">{{ windowLabel }}</span>
      </div>
      <button
        type="button"
        class="block w-full min-w-0 cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="`${node.name} 三网${kind === 'latency' ? '延迟' : '丢包'}历史曲线`"
        @click.capture.stop="emit('open')"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <div class="flex flex-col" :class="compact ? 'gap-1.5' : 'gap-2.5'">
          <div v-for="line in lines" :key="line.key" class="min-w-0">
            <div class="flex items-center justify-between gap-1 text-[11px] leading-[1.2] tabular-nums">
              <span class="min-w-0 truncate text-muted-foreground" :title="line.name">{{ line.name }}</span>
              <span class="shrink-0 font-medium" :style="{ color: kind === 'latency' ? line.latencyColor : line.lossColor }">
                {{ kind === 'latency' ? line.latencyDisplay : line.lossDisplay }}
              </span>
            </div>
            <div v-if="showBars" class="mt-1 grid grid-cols-20 gap-[2px]" :class="compact ? 'h-[5px]' : 'h-[7px]'">
              <DataTooltip
                v-for="bar in line.bars" :key="bar.key"
                placement="top" :content="bar.tooltip" class="h-full min-w-0"
                content-class="whitespace-pre-wrap w-max px-2 text-[11px] !leading-snug"
              >
                <span
                  class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-150"
                  :class="(kind === 'latency' ? bar.latency : bar.loss) === null ? 'opacity-15' : ''"
                  :style="{ backgroundColor: kind === 'latency' ? bar.latencyColor : bar.lossColor }"
                />
              </DataTooltip>
            </div>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
