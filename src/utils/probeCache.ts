import type { PingWindowPoint } from '@/utils/rpc'
import type { PingLineUpdate } from '@/utils/threeNetPing'
import { PROBE_KEYS, probeNumber } from '@/utils/threeNetPing'

export interface StoredProbeNode { samples: PingWindowPoint[], observedThrough: number }
export const PROBE_CACHE_KEY = 'emerald-three-net-live-v2'
export const LEGACY_PROBE_CACHE_KEY = 'emerald-three-net-live-v1'
export const LUMINA_PROBE_CACHE_KEY = 'cfsm-luminaplus:ping-live:v1'

/** Compact v2 preserves whether each metric was present in a delta, including explicit null. */
export function encodeProbeSample(point: PingWindowPoint): Array<number | null> {
  let delayMask = 0
  let lossMask = 0
  const delays: Array<number | null> = []
  const losses: Array<number | null> = []
  PROBE_KEYS.forEach((key, index) => {
    const line = point.lines?.[key]
    if (line && Object.hasOwn(line, 'latency'))
      delayMask |= 1 << index
    if (line && Object.hasOwn(line, 'loss'))
      lossMask |= 1 << index
    delays.push(probeNumber(line?.latency))
    losses.push(probeNumber(line?.loss))
  })
  return [Date.parse(point.time), delayMask, lossMask, ...delays, ...losses]
}

function validTime(raw: unknown): number | null {
  const time = probeNumber(raw)
  return time !== null && time > 0 && time <= Date.now() + 120_000 ? time : null
}

function decodeCompact(entry: unknown, lumina: boolean): PingWindowPoint | null {
  if (!Array.isArray(entry))
    return null
  const time = validTime(entry[0])
  if (time === null)
    return null
  const count = lumina ? Math.floor((entry.length - 1) / 2) : 8
  if (lumina ? ![4, 8].includes(count) || entry.length !== count * 2 + 1 : entry.length !== 19)
    return null
  const delayMask = lumina ? (1 << count) - 1 : Number(entry[1])
  const lossMask = lumina ? (1 << count) - 1 : Number(entry[2])
  if (!Number.isInteger(delayMask) || !Number.isInteger(lossMask) || delayMask < 0 || delayMask > 255 || lossMask < 0 || lossMask > 255)
    return null
  const lines: Record<string, PingLineUpdate> = {}
  for (let index = 0; index < count; index++) {
    const line: PingLineUpdate = {}
    const delay = entry[(lumina ? 1 : 3) + index]
    const loss = entry[(lumina ? 1 + count : 11) + index]
    if (delayMask & (1 << index))
      line.latency = probeNumber(delay)
    if (lossMask & (1 << index)) {
      const value = probeNumber(loss)
      line.loss = value !== null && value <= 100 ? value : null
    }
    if (Object.keys(line).length)
      lines[PROBE_KEYS[index]!] = line
  }
  return { time: new Date(time).toISOString(), latency: null, loss: null, lines }
}

function decodeLegacy(entry: unknown): PingWindowPoint | null {
  if (!entry || typeof entry !== 'object')
    return null
  const point = entry as PingWindowPoint
  const time = typeof point.time === 'string' ? Date.parse(point.time) : Number.NaN
  if (!Number.isFinite(time) || validTime(time) === null || !point.lines || typeof point.lines !== 'object')
    return null
  const lines: Record<string, PingLineUpdate> = {}
  for (const key of PROBE_KEYS) {
    const old = point.lines[key]
    const delay = probeNumber(old?.latency)
    const loss = probeNumber(old?.loss)
    const line: PingLineUpdate = {}
    // v1 discarded absent delta fields as null. Do not migrate those fabricated empty events.
    if (delay !== null)
      line.latency = delay
    if (loss !== null && loss <= 100)
      line.loss = loss
    if (loss === 100)
      line.latency = null
    if (Object.keys(line).length)
      lines[key] = line
  }
  return Object.keys(lines).length ? { time: new Date(time).toISOString(), latency: null, loss: null, lines } : null
}

export function decodeProbeNodes(raw: string | null, format: 'v2' | 'legacy' | 'lumina'): Record<string, StoredProbeNode> {
  if (!raw)
    return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    if (format === 'v2' && parsed.v !== 2)
      return {}
    if (format === 'lumina' && parsed.v !== 1)
      return {}
    const nodes = format === 'legacy' ? parsed : parsed.nodes
    if (!nodes || typeof nodes !== 'object' || Array.isArray(nodes))
      return {}
    const result: Record<string, StoredProbeNode> = {}
    for (const [id, node] of Object.entries(nodes).slice(0, 128)) {
      const saved = node as { samples?: unknown[], observedThrough?: unknown }
      const entries = format === 'v2' ? saved?.samples : node
      if (!Array.isArray(entries))
        continue
      const samples = entries.map(entry => format === 'legacy' ? decodeLegacy(entry) : decodeCompact(entry, format === 'lumina'))
        .filter((point): point is PingWindowPoint => point !== null)
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      result[id] = {
        samples,
        observedThrough: format === 'v2' ? validTime(saved.observedThrough) ?? 0 : samples.length ? Date.parse(samples.at(-1)!.time) : 0,
      }
    }
    return result
  }
  catch {
    return {}
  }
}
