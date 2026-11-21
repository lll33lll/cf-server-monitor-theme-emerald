import { useNodesStore } from '@/stores/nodes'
import { getCachedSiteConfigs } from '@/utils/api'
import { LUMINA_PROBE_CACHE_KEY } from '@/utils/probeCache'
import { bucketAverage, projectPingLine, THREE_NET_KEYS } from '@/utils/threeNetPing'

const SAFE_GITHUB_THEME = /^https:\/\/github\.com\/[^?#\s]+$/

function safeReferenceInfo() {
  try {
    const raw = localStorage.getItem(LUMINA_PROBE_CACHE_KEY)
    const saved = raw ? JSON.parse(raw) : null
    const recordLengths = new Set<number>()
    for (const entries of Object.values(saved?.nodes ?? {})) {
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (Array.isArray(entry))
            recordLengths.add(entry.length)
        }
      }
    }
    return { present: Boolean(raw), schema: typeof saved?.v === 'number' ? saved.v : null, savedAt: typeof saved?.savedAt === 'number' && Number.isFinite(saved.savedAt) ? saved.savedAt : null, nodeCount: Object.keys(saved?.nodes ?? {}).length, recordLengths: [...recordLengths] }
  }
  catch {
    return { present: false, schema: null, savedAt: null, nodeCount: 0, unavailable: true }
  }
}

/** Only whitelisted probe data: no tokens, cookies, passwords, IPs, prices or API secrets. */
export function collectLossDiagnostics() {
  const store = useNodesStore()
  const capturedAt = Date.now()
  const referenceInfo = safeReferenceInfo()
  const panels = [...document.querySelectorAll<HTMLElement>('[data-loss-node]')]
  const nodes = store.nodes.map((node) => {
    const rendered = panels.filter(panel => panel.dataset.lossNode === node.uuid).map(panel => ({
      plotNow: Number(panel.dataset.lossClock),
      weightedAt: Number(panel.dataset.lossAsOf),
      metrics: Array.from(panel.querySelectorAll<HTMLElement>('[data-loss-kind]'), column => ({
        metric: column.dataset.lossKind,
        values: Array.from(column.querySelectorAll<HTMLElement>('[data-loss-carrier]'), span => ({
          carrier: span.dataset.lossCarrier,
          text: span.textContent?.trim(),
          raw: span.dataset.lossValue ?? null,
        })),
      })),
    }))
    const input = store.getLossDiagnosticInputs(node.uuid)
    const plotNow = rendered[0]?.plotNow || capturedAt
    const weightedAt = input.weightedAt || plotNow
    const comparisons = THREE_NET_KEYS.map((key) => {
      const own = projectPingLine(key, input.window, input.mergedMeasured, plotNow, store.pingHistoryHours, store.pingHistoryStepMs, node.online ? undefined : Date.parse(node.time), weightedAt)
      const reference = input.referenceMeasured.length ? projectPingLine(key, input.window, input.referenceMeasured, plotNow, store.pingHistoryHours, store.pingHistoryStepMs, node.online ? undefined : Date.parse(node.time), weightedAt) : null
      return {
        carrier: key,
        latestLatency: Number.isFinite(node.ping?.[key]?.latest) ? node.ping![key]!.latest : null,
        latestLoss: Number.isFinite(node.ping?.[key]?.loss) ? node.ping![key]!.loss : null,
        emeraldComputed: bucketAverage(own, 'loss'),
        referencePersistedOnlyComputed: reference ? bucketAverage(reference, 'loss') : null,
        emeraldBuckets: own,
        referencePersistedOnlyBuckets: reference,
      }
    })
    return { id: node.uuid, name: node.name, updatedAt: node.time, online: node.online, rendered, comparisons, input }
  })
  const githubTheme = new URL(location.href).searchParams.get('theme_url')
  const safeTheme = githubTheme && SAFE_GITHUB_THEME.test(githubTheme) ? githubTheme : null
  return {
    schema: 'emerald-loss-diagnostic-v1',
    themeVersion: __BUILD_VERSION__,
    themeBuild: __BUILD_GIT_HASH__,
    origin: location.origin,
    previewTheme: safeTheme,
    capturedAt,
    referenceInfo,
    backendVersion: getCachedSiteConfigs()[0]?.version ?? null,
    windowHours: store.pingHistoryHours,
    note: 'Reference comparison uses only persisted LuminaPlus samples and this page\'s backend window. It is NOT the other tab\'s live in-memory displayed rate. No storage or metrics were modified.',
    nodes,
  }
}

export function exportLossDiagnostics() {
  const data = collectLossDiagnostics()
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `emerald-loss-diagnostic-${new Date(data.capturedAt).toISOString().replaceAll(':', '-')}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
