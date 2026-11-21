/*!
 * Core algorithms from volcano-1025/CFSM-Theme-LuminaPlus v1.2.24 (391dc27).
 * Keep merge, duration weights, midpoint projection and final loss aggregation together.
 * No extra API requests; mean-only solid-color presentation remains in Emerald.
 *
 * MIT License
 *
 * Copyright (c) 2026 Shanyang242
 * Copyright (c) 2026 volcano-1025
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type { PingWindowPoint } from '@/utils/rpc'

const CARRIER_KEYS = ['ct', 'cu', 'cm', 'bd', 'node_1', 'node_2', 'node_3', 'node_4'] as const
type ProbeTarget = typeof CARRIER_KEYS[number]
const CARRIER_LOSS_KEYS = Object.fromEntries(CARRIER_KEYS.map(key => [key, `loss_${key}`])) as Record<ProbeTarget, `loss_${ProbeTarget}`>
type CarrierPingSnapshot = Record<ProbeTarget | `loss_${ProbeTarget}`, number | null>
interface PingLiveSample { time: number, ping: CarrierPingSnapshot, weight?: number }
interface PingRecord { time: number, value: number, count: number, loss: number | null }
interface PingOverviewItem { samples: PingRecord[], emptyTimes?: number[], metricIntervalMs?: number }
interface PingOverviewBucket {
  index: number
  value: number | null
  loss: number | null
  total: number
  lost: number
  startAt: number
  endAt: number
  offline: boolean
  positiveCount: number
}
const PING_WINDOW_MS = 2 * 60 * 60 * 1000
const SAMPLE_TTL_MS = PING_WINDOW_MS + 15 * 60 * 1000
export const HOMEPAGE_PING_BUCKET_COUNT = 20
const MIN_PING_WINDOW_MS = 30 * 60 * 1000
const MAX_PING_WINDOW_MS = SAMPLE_TTL_MS
const DEFAULT_SAMPLE_INTERVAL_MS = 60_000
const MIN_SAMPLE_INTERVAL_MS = 20_000
const MAX_SAMPLE_INTERVAL_MS = 300_000
const MAX_SAMPLE_HOLD_MS = 300_000
const DEFAULT_WINDOW_STEP_MS = 120_000
const DEFAULT_LOCAL_CADENCE_MS = 40_000
const MIN_SAMPLE_GAP_MS = 120_000
const WEIGHT_UNIT_MS = 15_000
const MAX_SAMPLES_PER_NODE = 192
const MIN_THINNED_GAP_MS = PING_WINDOW_MS / MAX_SAMPLES_PER_NODE

function thinSamples(samples: readonly PingLiveSample[]): PingLiveSample[] {
  if (samples.length <= MAX_SAMPLES_PER_NODE)
    return [...samples]

  const kept: PingLiveSample[] = []
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index]!
    const last = kept.at(-1)
    if (!last || last.time - sample.time >= MIN_THINNED_GAP_MS)
      kept.push(sample)
  }
  kept.reverse()
  if (kept.length <= MAX_SAMPLES_PER_NODE)
    return kept
  const span = kept.at(-1)!.time - kept[0]!.time
  const gap = Math.max(MIN_THINNED_GAP_MS, span / MAX_SAMPLES_PER_NODE)
  const sparse: PingLiveSample[] = []
  for (let index = kept.length - 1; index >= 0; index -= 1) {
    const sample = kept[index]!
    const last = sparse.at(-1)
    if (!last || last.time - sample.time >= gap)
      sparse.push(sample)
  }
  sparse.reverse()
  return sparse
}

function hasAnyValue(ping: CarrierPingSnapshot): boolean {
  return CARRIER_KEYS.some(key => ping[key] != null)
}
export function resolvePingSampleCounts(
  sample: Pick<PingRecord, 'value' | 'count' | 'loss'>,
) {
  const total
    = typeof sample.count === 'number' && Number.isFinite(sample.count) && sample.count > 0
      ? Math.max(1, Math.round(sample.count))
      : 1
  const reportedLoss = sample.loss
  const lost
    = typeof reportedLoss === 'number' && Number.isFinite(reportedLoss)
      ? Math.min(total, Math.max(0, (reportedLoss / 100) * total))
      : sample.value < 0
        ? total
        : 0
  return { total, lost, valid: total - lost }
}

export function inferIntervalSeconds(times: number[]): number | undefined {
  const sorted = [...new Set(times.filter(time => time > 0))].sort((a, b) => a - b)
  if (sorted.length < 2)
    return undefined

  const deltas: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i]! - sorted[i - 1]!
    if (delta > 0)
      deltas.push(delta)
  }
  if (deltas.length === 0)
    return undefined

  deltas.sort((a, b) => a - b)
  const median = deltas[Math.floor(deltas.length / 2)]!
  return Math.max(1, Math.round(median / 1000))
}
function resolveSampleIntervalMs(samples: readonly PingLiveSample[]): number {
  const seconds = inferIntervalSeconds(samples.map(sample => sample.time))
  if (!seconds)
    return DEFAULT_SAMPLE_INTERVAL_MS
  return Math.min(
    MAX_SAMPLE_INTERVAL_MS,
    Math.max(MIN_SAMPLE_INTERVAL_MS, seconds * 1000),
  )
}

function resolveWindowStepMs(window: readonly PingLiveSample[]): number {
  const gaps: number[] = []
  for (let index = 1; index < window.length; index += 1) {
    const gap = window[index]!.time - window[index - 1]!.time
    if (gap > 0)
      gaps.push(gap)
  }
  if (gaps.length === 0)
    return DEFAULT_WINDOW_STEP_MS
  gaps.sort((left, right) => left - right)
  return gaps[Math.floor(gaps.length / 2)]!
}

function resolveCadenceMs(samples: readonly PingLiveSample[]): number {
  const gaps: number[] = []
  for (let index = 1; index < samples.length; index += 1) {
    const gap = samples[index]!.time - samples[index - 1]!.time
    if (gap > 0)
      gaps.push(gap)
  }
  if (gaps.length === 0)
    return DEFAULT_LOCAL_CADENCE_MS
  gaps.sort((left, right) => left - right)
  return gaps[Math.floor(gaps.length / 2)]!
}

function mergeWindowWithLocal(
  window: readonly PingLiveSample[],
  local: readonly PingLiveSample[],
  now: number,
): readonly PingLiveSample[] {
  if (window.length === 0)
    return assignWeights(local, DEFAULT_WINDOW_STEP_MS, now)
  if (local.length === 0)
    return assignWeights(window, resolveWindowStepMs(window), now)

  const step = resolveWindowStepMs(window)
  const cadence = Math.min(resolveCadenceMs(local), MIN_SAMPLE_GAP_MS)
  const maxLocalGap = Math.max(step, cadence * 2)

  const out: PingLiveSample[] = []
  let cursor = 0
  for (const point of window) {
    while (cursor < local.length && local[cursor]!.time <= point.time) {
      out.push(local[cursor]!)
      cursor += 1
    }
    const before = cursor > 0 ? local[cursor - 1]! : null
    const after = cursor < local.length ? local[cursor]! : null
    const covered
      = before != null && after != null && after.time - before.time <= maxLocalGap
    if (covered)
      continue
    if (
      !hasAnyValue(point.ping)
      && [before, after].some(
        near => near != null && Math.abs(near.time - point.time) <= step,
      )
    ) {
      continue
    }
    out.push(point)
  }
  for (; cursor < local.length; cursor += 1) out.push(local[cursor]!)

  return assignWeights(out, step, now)
}

function assignWeights(
  samples: readonly PingLiveSample[],
  stepMs: number,
  now: number,
): PingLiveSample[] {
  return samples.map((sample, index) => {
    const next = samples[index + 1]
    const span = (next ? next.time : now) - sample.time
    const bounded = Math.min(span, stepMs * 4)
    return { ...sample, weight: Math.max(1, Math.round(bounded / WEIGHT_UNIT_MS)) }
  })
}

function resolveOfflineSince(offlineSince?: number | null): number | null {
  return typeof offlineSince === 'number'
    && Number.isFinite(offlineSince)
    && offlineSince > 0
    ? offlineSince
    : null
}

function resolvePingWindowMs(
  ping: Pick<PingOverviewItem, 'samples' | 'emptyTimes'>,
  offlineAt: number | null,
  now: number,
  override?: number,
): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.min(MAX_PING_WINDOW_MS, Math.max(MIN_PING_WINDOW_MS, override))
  }
  let oldest = Number.POSITIVE_INFINITY
  const consider = (time: number) => {
    if (
      Number.isFinite(time)
      && time > 0
      && time <= now
      && (offlineAt == null || time <= offlineAt)
      && time < oldest
    ) {
      oldest = time
    }
  }
  for (const sample of ping.samples ?? []) consider(sample.time)
  for (const time of ping.emptyTimes ?? []) consider(time)
  if (!Number.isFinite(oldest))
    return PING_WINDOW_MS
  return Math.min(MAX_PING_WINDOW_MS, Math.max(MIN_PING_WINDOW_MS, now - oldest))
}

export function buildPingBuckets(
  ping: Pick<PingOverviewItem, 'samples' | 'metricIntervalMs' | 'emptyTimes'>,
  count?: number,
  now = Date.now(),
  offlineSince?: number | null,
  windowMs?: number,
): PingOverviewBucket[] {
  const resolvedOfflineAt = resolveOfflineSince(offlineSince)
  const offlineAt = resolvedOfflineAt == null ? null : Math.min(resolvedOfflineAt, now)
  const totalWindowMs = resolvePingWindowMs(ping, offlineAt, now, windowMs)
  const requestedCount = count ?? HOMEPAGE_PING_BUCKET_COUNT
  const boundedRequestedCount
    = Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(240, Math.max(1, Math.round(requestedCount)))
      : HOMEPAGE_PING_BUCKET_COUNT
  const metricIntervalMs
    = typeof ping.metricIntervalMs === 'number'
      && Number.isFinite(ping.metricIntervalMs)
      && ping.metricIntervalMs > 0
      ? ping.metricIntervalMs
      : 0
  const resolvedCount = boundedRequestedCount
  const bucketMs = totalWindowMs / resolvedCount
  const windowStart = now - totalWindowMs
  const totals = Array.from<number>({ length: resolvedCount }).fill(0)
  const losts = Array.from<number>({ length: resolvedCount }).fill(0)
  const positiveSums = Array.from<number>({ length: resolvedCount }).fill(0)
  const positiveCounts = Array.from<number>({ length: resolvedCount }).fill(0)

  const addSampleToBucket = (
    bucketIndex: number,
    sample: PingOverviewItem['samples'][number],
  ) => {
    const { total: sampleCount, lost: sampleLost, valid: sampleValid }
      = resolvePingSampleCounts(sample)

    totals[bucketIndex]! += sampleCount
    losts[bucketIndex]! += sampleLost
    if (sample.value >= 0 && sampleValid > 0) {
      positiveSums[bucketIndex]! += sample.value * sampleValid
      positiveCounts[bucketIndex]! += sampleValid
    }
  }
  const beforeOffline = (time: number) => offlineAt == null || time <= offlineAt

  const eventTimes = [
    ...(ping.samples ?? []).map(sample => sample.time),
    ...(ping.emptyTimes ?? []),
  ]
    .filter(beforeOffline)
    .sort((left, right) => left - right)

  const nextEventAfter = (time: number): number | undefined => {
    let low = 0
    let high = eventTimes.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (eventTimes[mid]! <= time)
        low = mid + 1
      else high = mid
    }
    return eventTimes[low]
  }
  const holdCapMs = Math.max(MAX_SAMPLE_HOLD_MS, bucketMs * 2)
  const holdMs
    = metricIntervalMs > 0
      ? Math.min(holdCapMs, Math.max(metricIntervalMs, bucketMs) * 2)
      : 0

  const leadingHoldMs = (time: number): number => {
    if (holdMs <= 0)
      return 0
    const gapToNext = (nextEventAfter(time) ?? time + metricIntervalMs) - time
    return Math.min(holdMs, Math.max(metricIntervalMs, gapToNext))
  }

  const samples = (ping.samples ?? []).filter(sample => beforeOffline(sample.time))
  for (const [order, sample] of samples.entries()) {
    if (sample.time > now)
      continue

    const coverEnd = Math.max(
      sample.time,
      Math.min(
        nextEventAfter(sample.time) ?? Number.POSITIVE_INFINITY,
        sample.time + holdMs,
        offlineAt ?? Number.POSITIVE_INFINITY,
        now,
      ),
    )
    if (coverEnd <= windowStart)
      continue
    const coverStart
      = order === 0
        ? Math.max(sample.time - leadingHoldMs(sample.time), windowStart)
        : sample.time
    let assigned = false
    for (let index = 0; index < resolvedCount; index += 1) {
      const midpoint = windowStart + (index + 0.5) * bucketMs
      if (midpoint >= coverStart && midpoint < coverEnd) {
        addSampleToBucket(index, sample)
        assigned = true
      }
    }
    if (assigned)
      continue
    const overlapStart = Math.max(coverStart, windowStart)
    const overlapEnd = Math.max(Math.min(coverEnd, now), overlapStart)
    const center = overlapStart + (overlapEnd - overlapStart) / 2
    let bucketIndex = Math.floor((center - windowStart) / bucketMs)
    if (bucketIndex < 0)
      continue
    if (bucketIndex >= resolvedCount)
      bucketIndex = resolvedCount - 1
    addSampleToBucket(bucketIndex, sample)
  }

  return Array.from({ length: resolvedCount }, (_, index) => {
    const startAt = windowStart + index * bucketMs
    const endAt = startAt + bucketMs
    const total = totals[index]!
    const lostExact = losts[index]!
    const lost = Math.round(lostExact)
    const positiveCount = positiveCounts[index]!

    return {
      index,
      value: positiveCount > 0 ? positiveSums[index]! / positiveCount : null,
      loss: total > 0 ? (lostExact / total) * 100 : null,
      total,
      lost,
      positiveCount,
      startAt,
      endAt,
      offline: offlineAt != null && startAt >= offlineAt,
    }
  })
}

export function lossFromBuckets(buckets: readonly PingOverviewBucket[]): number | null {
  let lost = 0
  let total = 0
  for (const bucket of buckets) {
    if (bucket.loss == null || !Number.isFinite(bucket.loss) || bucket.total <= 0)
      continue
    lost += (bucket.loss / 100) * bucket.total
    total += bucket.total
  }
  return total > 0 ? (lost / total) * 100 : null
}

export const LUMINA_PAIR_CACHE_KEY = 'emerald-three-net-lumina:v1'
export const LUMINA_SAMPLE_TTL_MS = SAMPLE_TTL_MS

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Reconstruct a full snapshot from a delta without clearing omitted fields. */
export function completeLuminaPoint(point: PingWindowPoint, previous?: PingWindowPoint): PingWindowPoint {
  const lines: NonNullable<PingWindowPoint['lines']> = {}
  for (const key of CARRIER_KEYS) {
    const update = point.lines?.[key]
    const old = previous?.lines?.[key]
    const latency = update && Object.hasOwn(update, 'latency') ? positive(update.latency) : positive(old?.latency)
    const rawLoss = update && Object.hasOwn(update, 'loss') ? positive(update.loss) : positive(old?.loss)
    lines[key] = { latency, loss: rawLoss !== null && rawLoss <= 100 ? rawLoss : null }
  }
  return { time: point.time, latency: null, loss: null, lines }
}

function toSample(point: PingWindowPoint): PingLiveSample {
  const ping = {} as CarrierPingSnapshot
  for (const key of CARRIER_KEYS) {
    const loss = positive(point.lines?.[key]?.loss)
    ping[key] = positive(point.lines?.[key]?.latency) ?? (loss !== null && loss > 0 ? -1 : null)
    ping[CARRIER_LOSS_KEYS[key]] = loss
  }
  return { time: Date.parse(point.time), ping }
}

export function hasLuminaValues(point: PingWindowPoint): boolean {
  return hasAnyValue(toSample(point).ping)
}

export function sameLuminaValues(a: PingWindowPoint, b: PingWindowPoint): boolean {
  return samePing(toSample(a).ping, toSample(b).ping)
}

function samePing(a: CarrierPingSnapshot, b: CarrierPingSnapshot): boolean {
  for (const key of CARRIER_KEYS) {
    if (a[key] !== b[key] || a[CARRIER_LOSS_KEYS[key]] !== b[CARRIER_LOSS_KEYS[key]])
      return false
  }
  return true
}

export function thinLuminaPoints(points: readonly PingWindowPoint[]): PingWindowPoint[] {
  const byTime = new Map(points.map(point => [Date.parse(point.time), point]))
  return thinSamples(points.map(toSample)).map(sample => byTime.get(sample.time)!)
}

export function encodeLuminaPoint(point: PingWindowPoint): Array<number | null> {
  const sample = toSample(point)
  return [sample.time, ...CARRIER_KEYS.map(key => sample.ping[key]), ...CARRIER_KEYS.map(key => sample.ping[CARRIER_LOSS_KEYS[key]])]
}

/** Keep the reference baseline intact, including its gaps; do not mix a different old history into it. */
export function combineLuminaMeasured(reference: readonly PingWindowPoint[], own: readonly PingWindowPoint[]): PingWindowPoint[] {
  const refs = reference.filter(point => Number.isFinite(Date.parse(point.time))).slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  if (!refs.length || !refs.some(hasLuminaValues))
    return [...own]
  const lastReference = Date.parse(refs.at(-1)!.time)
  // Preserve all own samples in their cache/detail history, but only append genuinely newer samples to the baseline.
  const newTail = own.filter(point => Date.parse(point.time) > lastReference)
  return [...refs, ...newTail].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
}

/** Exact LuminaPlus merge / weight / midpoint-bucket pipeline; only presentation is adapted. */
export function buildLuminaProbeBuckets(
  key: ProbeTarget,
  window: readonly PingWindowPoint[],
  measured: readonly PingWindowPoint[],
  plotNow: number,
  windowMs: number,
  offlineSince?: number,
  weightedAt = plotNow,
) {
  const fresh = (point: PingWindowPoint) => {
    const time = Date.parse(point.time)
    return Number.isFinite(time) && time > 0 && weightedAt - time <= SAMPLE_TTL_MS
  }
  const native = window.filter(fresh).map(toSample).sort((a, b) => a.time - b.time)
  const local = measured.filter(fresh).map(toSample).sort((a, b) => a.time - b.time)
  const merged = thinSamples(mergeWindowWithLocal(native, local, weightedAt))
  const records: PingRecord[] = []
  const emptyTimes: number[] = []
  for (const sample of merged) {
    const value = sample.ping[key]
    if (value === null) {
      emptyTimes.push(sample.time)
      continue
    }
    records.push({ time: sample.time, value, count: sample.weight ?? 1, loss: sample.ping[CARRIER_LOSS_KEYS[key]] })
  }
  return buildPingBuckets({ samples: records, emptyTimes, metricIntervalMs: resolveSampleIntervalMs(merged) }, 20, plotNow, offlineSince, windowMs)
}
