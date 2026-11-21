import type { PingWindowPoint } from '@/utils/rpc'
import { buildLuminaProbeBuckets } from '@/utils/luminaProbe'

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

/** Use LuminaPlus v1.2.24's core, not independent duration integration. */
export function projectPingLine(
  key: ThreeNetKey,
  window: readonly PingWindowPoint[],
  measured: readonly PingWindowPoint[],
  end: number,
  hours: number,
  _nativeStep: number,
  offlineSince?: number,
  weightedAt = end,
): PingBucket[] {
  return buildLuminaProbeBuckets(key, window, measured, end, hours * 3_600_000, offlineSince, weightedAt).map(bar => ({
    start: bar.startAt,
    end: bar.endAt,
    latency: bar.value,
    loss: bar.loss,
    latencyWeight: bar.positiveCount,
    lossWeight: bar.total,
  }))
}

export function bucketAverage(buckets: readonly PingBucket[], metric: 'latency' | 'loss'): number | null {
  let total = 0
  let weight = 0
  for (const bucket of buckets) {
    const value = bucket[metric]
    const count = metric === 'latency' ? bucket.latencyWeight : bucket.lossWeight
    if (value !== null && count > 0) {
      total += (metric === 'loss' ? value / 100 : value) * count
      weight += count
    }
  }
  return weight > 0 ? total / weight * (metric === 'loss' ? 100 : 1) : null
}

export function formatPingValue(value: number | null, metric: 'latency' | 'loss'): string {
  if (value === null || !Number.isFinite(value))
    return '—'
  if (metric === 'latency')
    return value < 1 ? '<1 ms' : `${Math.round(value)} ms`
  return `${value.toFixed(1)}%`
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
