import type { PingWindowPoint } from '@/utils/rpc'

export const THREE_NET_KEYS = ['ct', 'cu', 'cm'] as const
export type ThreeNetKey = typeof THREE_NET_KEYS[number]
export const THREE_NET_NAMES: Record<ThreeNetKey, string> = { ct: '电信', cu: '联通', cm: '移动' }
export const THREE_NET_BAR_COUNT = 20
export const PROBE_KEYS = ['ct', 'cu', 'cm', 'bd', 'node_1', 'node_2', 'node_3', 'node_4'] as const

export interface PingLineValue {
  latency: number | null
  loss: number | null
}
export type PingLineUpdate = Partial<PingLineValue>

export interface PingBucket extends PingLineValue {
  start: number
  end: number
  latencyPeak: number | null
  latencyWeight: number
  lossWeight: number
}

export function probeNumber(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim()))
    return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function pingLineValue(latency: unknown, loss: unknown): PingLineValue {
  const delay = probeNumber(latency)
  const rawLoss = probeNumber(loss)
  const percent = rawLoss !== null && rawLoss <= 100 ? rawLoss : null
  return { latency: percent === 100 ? null : delay, loss: percent }
}

/** Missing delta fields stay absent. Explicit null/false remains an empty observation, not zero. */
export function probeUpdatesFromWire(wire: Record<string, unknown>): Record<string, PingLineUpdate> {
  const lines: Record<string, PingLineUpdate> = {}
  for (const key of PROBE_KEYS) {
    const update: PingLineUpdate = {}
    if (Object.hasOwn(wire, `ping_${key}`))
      update.latency = probeNumber(wire[`ping_${key}`])
    if (Object.hasOwn(wire, `loss_${key}`)) {
      const loss = probeNumber(wire[`loss_${key}`])
      update.loss = loss !== null && loss <= 100 ? loss : null
    }
    if (Object.keys(update).length)
      lines[key] = update
  }
  return lines
}

/** Infer the real spacing: the REST grid is not necessarily exactly hours / points. */
function nativeInterval(points: readonly PingWindowPoint[], fallback: number): number {
  const times = [...new Set(points.map(point => Date.parse(point.time)).filter(Number.isFinite))].sort((a, b) => a - b)
  const gaps = times.slice(1).map((time, index) => time - times[index]!).filter(gap => gap > 0).sort((a, b) => a - b)
  return gaps.length ? gaps[Math.floor(gaps.length / 2)]! : fallback
}

/** Independent per-metric timelines prevent a loss-only frame from clearing latency, and vice versa. */
export function projectPingLine(
  key: ThreeNetKey,
  window: readonly PingWindowPoint[],
  live: readonly PingWindowPoint[],
  end: number,
  hours: number,
  nativeStep: number,
  offlineSince?: number,
  observedThrough?: number,
): PingBucket[] {
  const start = end - hours * 3_600_000
  const size = (end - start) / THREE_NET_BAR_COUNT
  const cutoff = Number.isFinite(offlineSince) ? Math.min(end, offlineSince!) : end
  const buckets: PingBucket[] = Array.from({ length: THREE_NET_BAR_COUNT }, (_, index) => ({
    start: start + size * index,
    end: start + size * (index + 1),
    latency: null,
    loss: null,
    latencyPeak: null,
    latencyWeight: 0,
    lossWeight: 0,
  }))
  interface Segment { start: number, end: number, value: number | null, live: boolean }
  const step = Math.max(1, nativeInterval(window, nativeStep))
  const localGapCap = Math.max(120_000, Math.min(step, 300_000))

  function segmentsFor(metric: 'latency' | 'loss'): Segment[] {
    const segments: Segment[] = []
    for (const [points, isLive] of [[window, false], [live, true]] as const) {
      const events = points.filter(point => point.lines?.[key] && Object.hasOwn(point.lines[key]!, metric))
        .slice()
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      for (let index = 0; index < events.length; index++) {
        const point = events[index]!
        const at = Date.parse(point.time)
        if (!Number.isFinite(at) || at >= cutoff)
          continue
        const next = events[index + 1]
        const nextAt = next ? Date.parse(next.time) : Number.POSITIVE_INFINITY
        let limit = at + (isLive ? localGapCap : step)
        // A live delta stream holds its last reported state through actual received heartbeats.
        // It is not a new ping sample and is never extended through a closed-page/offline gap.
        if (isLive && !next && Number.isFinite(observedThrough))
          limit = Math.max(at, observedThrough!)
        const until = Math.min(nextAt, limit, cutoff)
        if (until > Math.max(start, at))
          segments.push({ start: Math.max(start, at), end: until, value: probeNumber(point.lines![key]![metric]), live: isLive })
      }
    }
    return segments
  }

  const latency = segmentsFor('latency')
  const loss = segmentsFor('loss')
  const all = [...latency, ...loss]
  const boundaries = [...new Set([start, end, ...all.flatMap(segment => [segment.start, segment.end])])].sort((a, b) => a - b)
  function choose(segments: Segment[], from: number, to: number): Segment | undefined {
    const candidates = segments.filter(segment => segment.start <= from && segment.end >= to)
    return candidates.find(segment => segment.live) ?? candidates[0]
  }
  for (let index = 0; index < boundaries.length - 1; index++) {
    const from = boundaries[index]!
    const to = boundaries[index + 1]!
    const l = choose(latency, from, to)
    const p = choose(loss, from, to)
    const delay = p?.value === 100 ? null : l?.value ?? null
    const percent = p?.value !== null && p?.value !== undefined && p.value <= 100 ? p.value : null
    const first = Math.max(0, Math.floor((from - start) / size))
    const last = Math.min(THREE_NET_BAR_COUNT - 1, Math.ceil((to - start) / size) - 1)
    for (let slot = first; slot <= last; slot++) {
      const bucket = buckets[slot]!
      const weight = Math.max(0, Math.min(to, bucket.end) - Math.max(from, bucket.start))
      if (weight <= 0)
        continue
      if (delay !== null) {
        bucket.latency = ((bucket.latency ?? 0) * bucket.latencyWeight + delay * weight) / (bucket.latencyWeight + weight)
        bucket.latencyWeight += weight
        bucket.latencyPeak = Math.max(bucket.latencyPeak ?? delay, delay)
      }
      if (percent !== null) {
        bucket.loss = ((bucket.loss ?? 0) * bucket.lossWeight + percent * weight) / (bucket.lossWeight + weight)
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
  if (value === null || !Number.isFinite(value))
    return '—'
  if (metric === 'latency')
    return value < 1 ? '<1 ms' : `${Math.round(value)} ms`
  return value > 0 && value < 0.1 ? '<0.1%' : `${value.toFixed(1)}%`
}

export function pingColor(value: number | null, metric: 'latency' | 'loss'): string {
  if (value === null || !Number.isFinite(value))
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
  const hue = value <= 3 ? 145 - value / 3 * 90 : value <= 10 ? 55 - (value - 3) / 7 * 30 : 25 - Math.min(1, (value - 10) / 20) * 25
  return `hsl(${hue.toFixed(1)} 78% 43%)`
}
