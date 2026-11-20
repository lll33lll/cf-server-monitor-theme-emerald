import type { NodeStatusPing, PingWindowPoint } from '@/utils/rpc'

export const THREE_NET_KEYS = ['ct', 'cu', 'cm'] as const
export type ThreeNetKey = typeof THREE_NET_KEYS[number]
export const THREE_NET_NAMES: Record<ThreeNetKey, string> = { ct: '电信', cu: '联通', cm: '移动' }
export const THREE_NET_BAR_COUNT = 20

export interface PingLineValue {
  latency: number | null
  loss: number | null
}

export interface PingBucket extends PingLineValue {
  start: number
  end: number
  latencyWeight: number
  lossWeight: number
}

export function probeNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim()))
    return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function pingLineValue(latency: unknown, loss: unknown): PingLineValue {
  const delay = probeNumber(latency)
  const percent = probeNumber(loss)
  return {
    latency: delay !== null && delay > 0 && (percent === null || percent < 100) ? delay : null,
    loss: percent !== null && percent <= 100 ? percent : null,
  }
}

export function snapshotLines(ping?: Record<string, NodeStatusPing>): Record<string, PingLineValue> {
  return Object.fromEntries(Object.entries(ping ?? {}).map(([key, value]) => [key, pingLineValue(value.latest, value.loss)]))
}

/** Each native snapshot represents the following native interval; real live samples override only their own coverage. */
export function projectPingLine(
  key: ThreeNetKey,
  window: readonly PingWindowPoint[],
  live: readonly PingWindowPoint[],
  end: number,
  hours: number,
  nativeStep: number,
  offlineSince?: number,
): PingBucket[] {
  const start = end - hours * 3_600_000
  const size = (end - start) / THREE_NET_BAR_COUNT
  const buckets: PingBucket[] = Array.from({ length: THREE_NET_BAR_COUNT }, (_, index) => ({
    start: start + size * index,
    end: start + size * (index + 1),
    latency: null,
    loss: null,
    latencyWeight: 0,
    lossWeight: 0,
  }))
  interface Segment { start: number, end: number, value: PingLineValue, live: boolean }
  const segments: Segment[] = []
  for (const [points, isLive] of [[window, false], [live, true]] as const) {
    const sorted = points.filter(point => point.lines?.[key]).slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    for (let index = 0; index < sorted.length; index++) {
      const point = sorted[index]!
      const at = Date.parse(point.time)
      const next = sorted[index + 1]
      const until = Math.min(
        next ? Date.parse(next.time) : end,
        at + (isLive ? 120_000 : nativeStep),
        end,
        offlineSince ?? end,
      )
      if (until > start && until > at)
        segments.push({ start: Math.max(start, at), end: until, value: point.lines![key]!, live: isLive })
    }
  }

  // Split at every real boundary. Do not invent zero loss or stretch isolated points across gaps.
  const boundaries = [...new Set([start, end, ...segments.flatMap(segment => [segment.start, segment.end])])].sort((a, b) => a - b)
  for (let index = 0; index < boundaries.length - 1; index++) {
    const from = boundaries[index]!
    const to = boundaries[index + 1]!
    const candidates = segments.filter(segment => segment.start <= from && segment.end >= to)
    const chosen = candidates.find(segment => segment.live) ?? candidates[0]
    if (!chosen)
      continue
    const first = Math.max(0, Math.floor((from - start) / size))
    const last = Math.min(THREE_NET_BAR_COUNT - 1, Math.ceil((to - start) / size) - 1)
    for (let bucketIndex = first; bucketIndex <= last; bucketIndex++) {
      const bucket = buckets[bucketIndex]!
      const weight = Math.max(0, Math.min(to, bucket.end) - Math.max(from, bucket.start))
      if (chosen.value.latency !== null) {
        bucket.latency = ((bucket.latency ?? 0) * bucket.latencyWeight + chosen.value.latency * weight) / (bucket.latencyWeight + weight)
        bucket.latencyWeight += weight
      }
      if (chosen.value.loss !== null) {
        bucket.loss = ((bucket.loss ?? 0) * bucket.lossWeight + chosen.value.loss * weight) / (bucket.lossWeight + weight)
        bucket.lossWeight += weight
      }
    }
  }
  return buckets
}

export function bucketAverage(buckets: readonly PingBucket[], metric: 'latency' | 'loss'): number | null {
  let total = 0
  let weight = 0
  for (const bucket of buckets) {
    const value = bucket[metric]
    const count = metric === 'latency' ? bucket.latencyWeight : bucket.lossWeight
    if (value !== null && count > 0) {
      total += value * count
      weight += count
    }
  }
  return weight > 0 ? total / weight : null
}

export function formatPingValue(value: number | null, metric: 'latency' | 'loss'): string {
  if (value === null)
    return '—'
  if (metric === 'latency')
    return value < 1 ? '<1 ms' : `${Math.round(value)} ms`
  return value > 0 && value < 0.1 ? '<0.1%' : `${value.toFixed(1)}%`
}

export function pingColor(value: number | null, metric: 'latency' | 'loss'): string {
  if (value === null)
    return 'var(--muted-foreground)'
  if (metric === 'latency') {
    if (value <= 60)
      return '#059669'
    if (value <= 120)
      return '#22c55e'
    if (value <= 180)
      return '#a3e635'
    if (value <= 240)
      return '#facc15'
    return '#f43f5e'
  }
  // Continuous heat scale: 0% green, 3% yellow, 10% orange, >=30% red.
  const hue = value <= 3 ? 145 - value / 3 * 90 : value <= 10 ? 55 - (value - 3) / 7 * 30 : 25 - Math.min(1, (value - 10) / 20) * 25
  return `hsl(${hue.toFixed(1)} 78% 43%)`
}
