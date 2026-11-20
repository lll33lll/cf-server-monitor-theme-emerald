<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { formatDateTime } from '@/utils/helper'
import { placeProbeTooltip } from '@/utils/probeTooltip'
import { formatPingValue } from '@/utils/threeNetPing'

interface DisplayBar {
  key: number
  end: number
  latency: number | null
  loss: number | null
  latencyColor: string
  latencyPeak?: number | null
  peakColor?: string
  showPeak?: boolean
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
const position = ref({ left: 0, top: 0, arrow: 0, below: false, maxWidth: 360 })
let pointerId: number | null = null
let holdTimer: ReturnType<typeof setTimeout> | null = null
let disposed = false
let placementFrame: number | null = null

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
  const peak = props.metric === 'latency' && bar.latencyPeak !== null && bar.latencyPeak !== undefined
    ? ` · 峰值 ${Number(bar.latencyPeak.toFixed(1))} ms`
    : ''
  return `${props.name} · ${start} - ${end} · ${props.metric === 'latency' ? '平均 ' : ''}${summary}${peak}`
})

function clearTimer() {
  if (holdTimer !== null)
    clearTimeout(holdTimer)
  holdTimer = null
}

function releasePointer() {
  const id = pointerId
  pointerId = null
  if (id === null)
    return
  try {
    if (root.value?.hasPointerCapture(id))
      root.value.releasePointerCapture(id)
  }
  catch {}
}

function close() {
  clearTimer()
  if (placementFrame !== null)
    cancelAnimationFrame(placementFrame)
  placementFrame = null
  releasePointer()
  activeIndex.value = null
}

function scheduleBubble() {
  if (disposed || placementFrame !== null)
    return
  placementFrame = requestAnimationFrame(() => {
    placementFrame = null
    void placeBubble()
  })
}

async function placeBubble() {
  await nextTick()
  if (disposed || activeIndex.value === null || !root.value || !bubble.value)
    return
  const rect = root.value.getBoundingClientRect()
  const visual = window.visualViewport
  const viewport = {
    left: visual?.offsetLeft ?? 0,
    top: visual?.offsetTop ?? 0,
    width: visual?.width || document.documentElement.clientWidth,
    height: visual?.height || window.innerHeight,
  }
  const maxWidth = Math.max(1, viewport.width - 16)
  bubble.value.style.maxWidth = `${maxWidth}px`
  const width = bubble.value.offsetWidth
  const height = bubble.value.offsetHeight
  if (height > viewport.height - 16) {
    close()
    return
  }
  const anchor = rect.left + (activeIndex.value + 0.5) / props.bars.length * rect.width
  position.value = {
    ...placeProbeTooltip(anchor, rect.top + 8, props.compact ? 5 : 7, width, height, viewport),
    maxWidth,
  }
}

function select(index: number) {
  if (!props.bars.length)
    return
  activeIndex.value = Math.max(0, Math.min(props.bars.length - 1, index))
  scheduleBubble()
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
  clearTimer()
  // Keep the bubble after lifting the finger, and clear the bar highlight at the same time.
  holdTimer = setTimeout(close, HOLD_MS)
  releasePointer()
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

function documentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    close()
}

function bindOutside(open: boolean) {
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('keydown', documentKeydown)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  window.visualViewport?.removeEventListener('resize', close)
  window.visualViewport?.removeEventListener('scroll', close)
  if (open) {
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', documentKeydown)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    window.visualViewport?.addEventListener('resize', close)
    window.visualViewport?.addEventListener('scroll', close)
  }
}

watch(() => activeIndex.value !== null, bindOutside)
watch(text, scheduleBubble)
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
    >
      <span class="ping-mean" aria-hidden="true" />
      <span v-if="metric === 'latency' && bar.showPeak" class="ping-peak" :style="{ backgroundColor: bar.peakColor }" aria-hidden="true" />
    </span>
  </div>
  <Teleport to="body">
    <span
      v-if="activeIndex !== null && text" :id="bubbleId" ref="bubble"
      class="ping-bucket-bubble" :class="{ below: position.below }" role="tooltip"
      :style="{ 'left': `${position.left}px`, 'top': `${position.top}px`, '--arrow-x': `${position.arrow}px`, 'maxWidth': `${position.maxWidth}px` }"
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
  position: relative;
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: 1px;
  transition: opacity 150ms ease-out;
}
.ping-mean {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background-color: inherit;
  transform-origin: center;
  pointer-events: none;
  transition:
    transform 150ms ease-out,
    filter 150ms ease-out;
}
.ping-peak {
  position: absolute;
  left: 50%;
  top: -5px;
  width: min(100%, 3px);
  height: 2px;
  border-radius: 2px;
  transform: translateX(-50%);
  pointer-events: none;
}
.ping-bar.empty {
  opacity: 0.15;
}
.ping-bar.selected .ping-mean {
  transform: scaleY(1.6);
  filter: saturate(1.14) brightness(1.04);
}
.ping-bar.selected .ping-peak {
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
  .ping-bar,
  .ping-mean {
    transition: none;
  }
  .ping-bucket-bubble {
    animation: none;
  }
}
</style>
