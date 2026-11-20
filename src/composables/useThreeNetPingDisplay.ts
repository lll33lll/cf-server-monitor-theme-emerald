import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { useProbeMinuteClock } from '@/composables/useProbeMinuteClock'
import { useNodesStore } from '@/stores/nodes'
import { getCachedSiteConfigs } from '@/utils/api'
import { bucketAverage, formatPingValue, pingColor, pingLineValue, projectPingLine, THREE_NET_KEYS, THREE_NET_NAMES } from '@/utils/threeNetPing'

export function useThreeNetPingDisplay(uuid: MaybeRefOrGetter<string>) {
  const store = useNodesStore()
  const now = useProbeMinuteClock()
  const windowLabel = computed(() => store.showThreeNetDetails ? `近${store.pingHistoryHours}小时平均` : '实时')
  const node = computed(() => store.nodesByUuid.get(toValue(uuid)))
  const offlineSince = computed(() => node.value && !node.value.online ? Date.parse(node.value.time) : undefined)
  const observedThrough = computed(() => Math.min(store.pingObservedThroughByUuid[toValue(uuid)] ?? 0, now.value))
  // The expensive projection depends on probe history, not 1-second CPU/resource updates.
  const bucketsByKey = computed(() => {
    const id = toValue(uuid)
    const history = store.pingHistoryByUuid[id] ?? []
    const live = store.livePingHistoryByUuid[id] ?? []
    return THREE_NET_KEYS.map(key => projectPingLine(key, history, live, now.value, store.pingHistoryHours, store.pingHistoryStepMs, offlineSince.value, observedThrough.value))
  })
  const lines = computed(() => {
    const currentNode = node.value
    const config = getCachedSiteConfigs()[currentNode?.source_index ?? 0]
    return THREE_NET_KEYS.map((key, index) => {
      const name = config?.[`custom_${key}_name`]?.trim() || THREE_NET_NAMES[key]
      const buckets = bucketsByKey.value[index]!
      const latest = currentNode?.online ? pingLineValue(currentNode.ping?.[key]?.latest, currentNode.ping?.[key]?.loss) : { latency: null, loss: null }
      const latency = store.showThreeNetDetails ? bucketAverage(buckets, 'latency') : latest.latency
      const loss = store.showThreeNetDetails ? bucketAverage(buckets, 'loss') : latest.loss
      return {
        key,
        name,
        latency,
        loss,
        latencyDisplay: formatPingValue(latency, 'latency'),
        lossDisplay: formatPingValue(loss, 'loss'),
        latencyColor: pingColor(latency, 'latency'),
        lossColor: pingColor(loss, 'loss'),
        bars: buckets.map(bucket => ({
          key: bucket.start,
          end: bucket.end,
          latency: bucket.latency,
          loss: bucket.loss,
          latencyColor: pingColor(bucket.latency, 'latency'),
          lossColor: pingColor(bucket.loss, 'loss'),
        })),
      }
    })
  })
  return { lines, windowLabel, showBars: computed(() => store.showThreeNetDetails) }
}
