<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import NodeThreeNetPanels from '@/components/NodeThreeNetPanels.vue'

defineProps<{ node: NodeData, metric: 'latency' | 'loss' }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <NodeThreeNetPanels :node="node" :metric="metric" compact @open="emit('open')" />
</template>
