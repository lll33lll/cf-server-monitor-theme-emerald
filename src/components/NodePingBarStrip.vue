<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { formatDateTime } from '@/utils/helper'
import { formatPingValue } from '@/utils/threeNetPing'

interface DisplayBar {
  key: number
  end: number
  latency: number | null
  loss: number | null
  latencyColor: string
  lossColor: string
}

const props = defineProps<{
  bars: readonly DisplayBar[]
  metric: 'latency' | 'loss'
  name: string
  compact?: boolean
}>()

const HOLD_MS = 2500
const root = ref<HTMLElement | null>(null)
const bubble = ref<HTMLElement | null>(null)
const activeIndex = ref<number | null>(null)
const bubbleId = useId()
const position = ref({ left: 0, top: 0, arrow: 0, below: false })
let pointerId: number | null = null
let holdTimer: ReturnType<typeof setTimeout> | null = null
let disposed = false

const activeBar = computed(() => activeIndex.value === null ? null : props.bars[activeIndex.value] ?? null)
const text = computed(() => {
  const bar = activeBar.value
  if (!bar)
    return ''
  const start = formatDateTime(new Date(bar.key).toISOString(), 'HH:mm')
  const end = formatDateTime(new Date(bar.end).toISOString(), 'HH:mm')
  const value = bar[props.metric]
  const summary = value === null
    ? props.metric === 'latency' && bar.loss === 100 ? '探测失败' : '暂无样本'
    : props.metric === 'latency' ? `${Number(value.toFixed(1))} ms` : formatPingValue(value, 'loss')
  return `${props.name} · ${start} - ${end} · ${summary}`
})

function clearTimer() {
  if (holdTimer !== null)
    clearTimeout(holdTimer)
  holdTimer = null
}

function close() {
  clearTimer()
  pointerId = null
  activeIndex.value = null
}

async function placeBubble() {
  await nextTick()
  if (disposed || activeIndex.value === null || !root.value || !bubble.value)
    return
  const rect = root.value.getBoundingClientRect()
  const width = bubble.value.offsetWidth
  const height = bubble.value.offsetHeight
  const viewportWidth = document.documentElement.clientWidth
  const anchor = rect.left + (activeIndex.value + 0.5) / props.bars.length * rect.width
  const left = Math.max(8 + width / 2, Math.min(viewportWidth - 8 - width / 2, anchor))
  const top = rect.top + 8
  const below = top - height - 7 < 8
  position.value = {
    left,
    top: below ? top + (props.compact ? 5 : 7) + 7 : top - 7,
    arrow: Math.max(8, Math.min(width - 8, anchor - left + width / 2)),
    below,
  }
}

function select(index: number) {
  if (!props.bars.length)
    return
  activeIndex.value = Math.max(0, Math.min(props.bars.length - 1, index))
  void placeBubble()
}

function pickAt(clientX: number) {
  const rect = root.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0)
    return
  // The whole strip, including gaps, is a hit target; individual bars are too narrow for fingers.
  select(Math.floor((clientX - rect.left) / rect.width * props.bars.length))
}

function fineHover(event: PointerEvent) {
  return event.pointerType === 'mouse' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function down(event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0))
    return
  clearTimer()
  pickAt(event.clientX)
  if (fineHover(event))
    return
  pointerId = event.pointerId
  try {
    root.value?.setPointerCapture(event.pointerId)
  }
  catch {}
}

function move(event: PointerEvent) {
  if (fineHover(event) || pointerId === event.pointerId)
    pickAt(event.clientX)
}

function up(event: PointerEvent) {
  if (pointerId !== event.pointerId)
    return
  pointerId = null
  clearTimer()
  // Keep the bubble after lifting the finger, and clear the bar highlight at the same time.
  holdTimer = setTimeout(close, HOLD_MS)
}

function leave() {
  if (pointerId === null && holdTimer === null)
    close()
}

function keydown(event: KeyboardEvent) {
  const current = activeIndex.value ?? props.bars.length - 1
  if (event.key === 'Escape') {
    close()
  }
  else if (event.key === 'ArrowLeft') {
    select(current - 1)
  }
  else if (event.key === 'ArrowRight') {
    select(current + 1)
  }
  else if (event.key === 'Home') {
    select(0)
  }
  else if (event.key === 'End' || event.key === 'Enter' || event.key === ' ') {
    select(event.key === 'End' ? props.bars.length - 1 : current)
  }
  else {
    return
  }
  clearTimer()
  event.preventDefault()
}

function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target))
    close()
}

function bindOutside(open: boolean) {
  document.removeEventListener('pointerdown', outside, true)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  if (open) {
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
  }
}

watch(() => activeIndex.value !== null, bindOutside)
watch(text, () => void placeBubble())
watch([() => props.metric, () => props.name, () => props.bars.length], close)
onBeforeUnmount(() => {
  disposed = true
  close()
  bindOutside(false)
})
</script>

<template>
  <div
    ref="root"
    class="ping-bar-strip" :class="{ compact }"
    role="slider" tabindex="0" aria-orientation="horizontal"
    :aria-label="`${name} ${metric === 'latency' ? '延迟' : '丢包'}历史`"
    :aria-valuemin="1" :aria-valuemax="bars.length"
    :aria-valuenow="activeIndex === null ? bars.length : activeIndex + 1"
    :aria-valuetext="text || '历史柱状数据'"
    :aria-describedby="activeIndex === null ? undefined : bubbleId"
    @pointerdown.stop="down" @pointermove.stop="move" @pointerup.stop="up"
    @pointercancel.stop="close" @pointerleave="leave"
    @click.stop.prevent @keydown.stop="keydown" @blur="close"
  >
    <span
      v-for="(bar, index) in bars" :key="index"
      class="ping-bar"
      :class="{ selected: activeIndex === index, empty: bar[metric] === null }"
      :style="{ backgroundColor: metric === 'latency' ? bar.latencyColor : bar.lossColor }"
    />
  </div>
  <Teleport to="body">
    <span
      v-if="activeIndex !== null && text" :id="bubbleId" ref="bubble"
      class="ping-bucket-bubble" :class="{ below: position.below }" role="tooltip"
      :style="{ 'left': `${position.left}px`, 'top': `${position.top}px`, '--arrow-x': `${position.arrow}px` }"
    >{{ text }}</span>
  </Teleport>
</template>

<style scoped>
.ping-bar-strip {
  display: grid;
  grid-template-columns: repeat(20, minmax(0, 1fr));
  gap: 2px;
  height: 7px;
  padding-block: 8px;
  margin-block: -8px;
  box-sizing: content-box;
  touch-action: pan-y;
  cursor: crosshair;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.ping-bar-strip.compact {
  height: 5px;
}
.ping-bar-strip:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.ping-bar {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: 1px;
  transform-origin: center;
  transition:
    transform 150ms ease-out,
    filter 150ms ease-out,
    opacity 150ms ease-out;
}
.ping-bar.empty {
  opacity: 0.15;
}
.ping-bar.selected {
  transform: scaleY(1.6);
  filter: saturate(1.14) brightness(1.04);
}
.ping-bar.empty.selected {
  opacity: 0.55;
}
.ping-bucket-bubble {
  position: fixed;
  z-index: 10000;
  max-width: calc(100vw - 16px);
  width: max-content;
  padding: 6px 9px;
  border-radius: 6px;
  background: var(--foreground);
  color: var(--background);
  font-size: 11px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 3px 12px rgb(0 0 0 / 18%);
  pointer-events: none;
  white-space: normal;
  overflow-wrap: anywhere;
  transform: translate(-50%, -100%);
  animation: bubble-in 120ms ease-out;
}
.ping-bucket-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: var(--arrow-x);
  border: 4px solid transparent;
  border-top-color: var(--foreground);
  transform: translateX(-50%);
}
.ping-bucket-bubble.below {
  transform: translate(-50%, 0);
}
.ping-bucket-bubble.below::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: var(--foreground);
}
@keyframes bubble-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ping-bar {
    transition: none;
  }
  .ping-bucket-bubble {
    animation: none;
  }
}
</style>
