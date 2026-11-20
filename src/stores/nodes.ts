import type { Client, NodeStatus, NodeStatusPing, PingWindowPoint } from '@/utils/rpc'
import type { PingLineUpdate } from '@/utils/threeNetPing'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { parseNodeGroups } from '@/utils/groupHelper'
import { decodeProbeNodes, encodeProbeSample, LEGACY_PROBE_CACHE_KEY, LUMINA_PROBE_CACHE_KEY, PROBE_CACHE_KEY } from '@/utils/probeCache'
import { PROBE_KEYS, probeNumber } from '@/utils/threeNetPing'

/** 流量限制类型 */
export type TrafficLimitType = 'up' | 'down' | 'min' | 'max' | 'sum'

export interface PingHistoryPoint extends PingWindowPoint {}

/** 节点完整信息（合并 Client 和 Status） */
export interface NodeData {
  uuid: string
  source_id?: string
  source_index?: number
  // Client 信息
  name: string
  cpu_name: string
  virtualization: string
  kernel_version: string
  arch: string
  cpu_cores: number
  os: string
  boot_time: string
  gpu_name?: string
  gpu_info?: string
  ipv4?: string
  ipv6?: string
  region: string
  remark?: string
  public_remark: string
  mem_total: number
  swap_total: number
  disk_total: number
  version?: string
  weight: number
  price: number
  price_configured?: boolean
  billing_cycle: number
  auto_renewal: boolean
  currency: string
  expired_at: string
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: TrafficLimitType
  created_at: string
  updated_at: string
  // Status 信息
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  net_monthly_up: number
  net_monthly_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
  ping?: Record<string, NodeStatusPing>
  pingSample?: boolean
  pingSampleKeys?: string[]
  pingUpdates?: Record<string, PingLineUpdate>
}

/** WebSocket 连接状态 */
export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/** 状态数据（用于更新） */
interface StatusData {
  ram_total?: number
  swap_total?: number
  disk_total?: number
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  net_monthly_up: number
  net_monthly_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
  ping?: Record<string, NodeStatusPing>
  pingSample?: boolean
  pingSampleKeys?: string[]
  pingUpdates?: Record<string, PingLineUpdate>
}

const EARTH_SNAPSHOT_INTERVAL_MS = 60_000

/** 首页 ping/loss 历史摄取配置（由后端 /api/config 与 /api/servers 下发，缺省时回退旧行为） */
interface PingHistoryConfig {
  /** 后端 show_three_net_details：是否显示/消费三网延迟丢包详情（false 时卡片/列表隐藏相应信息） */
  showThreeNetDetails: boolean
  /** latency_window.points：保留的桶数 */
  points: number
  /** latency_window.hours：窗口时长（小时），桶长 = hours / points */
  hours: number
}

const PING_HISTORY_DEFAULTS: PingHistoryConfig = {
  // 缺省窗口：2 小时 / 20 格；后端下发的 hours/points 优先。
  showThreeNetDetails: true,
  points: 20,
  hours: 2,
}

const useNodesStore = defineStore('nodes', () => {
  // ===== 状态 =====
  const nodes = ref<NodeData[]>([])
  const earthNodes = ref<NodeData[]>([])
  const pingHistoryByUuid = ref<Record<string, PingHistoryPoint[]>>({})
  const livePingHistoryByUuid = ref<Record<string, PingWindowPoint[]>>({})
  const cacheKey = PROBE_CACHE_KEY
  const pingObservedThroughByUuid = ref<Record<string, number>>({})
  let cacheHydrated = false
  let cacheTimer: ReturnType<typeof setTimeout> | null = null
  const wsConnectionState = ref<WsConnectionState>('disconnected')
  const wsReconnectAttempts = ref<number>(0)
  const pingHistoryConfig = ref<PingHistoryConfig>({ ...PING_HISTORY_DEFAULTS })
  let lastEarthSnapshotAt = 0

  // ===== 计算属性 =====
  /** 在线节点数量 */
  const onlineCount = computed(() => nodes.value.filter(n => n.online).length)

  /** 总节点数量 */
  const totalCount = computed(() => nodes.value.length)

  /** 所有分组 */
  const groups = computed(() => {
    const groupSet = new Set<string>()
    nodes.value.forEach((n) => {
      parseNodeGroups(n.group).forEach(group => groupSet.add(group))
    })
    return Array.from(groupSet)
  })

  /** 按 UUID 索引的节点映射 */
  const nodesByUuid = computed(() => {
    const map = new Map<string, NodeData>()
    nodes.value.forEach((n) => {
      map.set(n.uuid, n)
    })
    return map
  })

  /** 后端 show_three_net_details：false 时只显示三网实时数值 */
  const showThreeNetDetails = computed(() => pingHistoryConfig.value.showThreeNetDetails)

  const pingHistoryHours = computed(() => pingHistoryConfig.value.hours)
  const pingHistoryStepMs = computed(() => pingHistoryBucketMs())

  function trimPingHistory(points: PingWindowPoint[]): PingWindowPoint[] {
    const oldest = Date.now() - pingHistoryHours.value * 3_600_000 - 15 * 60_000
    return points.filter(point => Date.parse(point.time) >= oldest && Date.parse(point.time) <= Date.now() + 120_000).slice(-16000)
  }

  function hydratePingCache(uuids: string[]): void {
    if (cacheHydrated)
      return
    cacheHydrated = true
    try {
      // Only read LuminaPlus's real cache; never write to or remove another theme's storage.
      const sources = [
        decodeProbeNodes(localStorage.getItem(LUMINA_PROBE_CACHE_KEY), 'lumina'),
        decodeProbeNodes(localStorage.getItem(LEGACY_PROBE_CACHE_KEY), 'legacy'),
        decodeProbeNodes(localStorage.getItem(PROBE_CACHE_KEY), 'v2'),
      ]
      for (const id of uuids) {
        for (const source of sources) {
          const node = source[id]
          if (!node)
            continue
          seedPingSamples(id, trimPingHistory(node.samples))
          pingObservedThroughByUuid.value[id] = Math.max(pingObservedThroughByUuid.value[id] ?? 0, node.observedThrough)
        }
      }
    }
    catch {}
  }

  function savePingCache(): void {
    if (cacheTimer)
      clearTimeout(cacheTimer)
    cacheTimer = null
    try {
      const active = new Set(nodes.value.map(node => node.uuid))
      const saved = Object.fromEntries(Object.entries(livePingHistoryByUuid.value)
        .filter(([uuid]) => active.has(uuid)).slice(0, 128)
        .map(([uuid, points]) => [uuid, {
          samples: trimPingHistory(points).map(encodeProbeSample),
          observedThrough: pingObservedThroughByUuid.value[uuid] ?? 0,
        }]))
      localStorage.setItem(cacheKey, JSON.stringify({ v: 2, nodes: saved }))
    }
    catch {}
  }

  function schedulePingCache(): void {
    cacheTimer ??= setTimeout(savePingCache, 30_000)
  }

  // ===== 方法 =====

  /**
   * 从 Client 对象创建节点数据
   */
  function createNodeFromClient(client: Client): NodeData {
    return {
      uuid: client.uuid,
      source_id: client.source_id,
      source_index: client.source_index,
      name: client.name,
      cpu_name: client.cpu_name,
      virtualization: client.virtualization,
      kernel_version: client.kernel_version,
      arch: client.arch,
      cpu_cores: client.cpu_cores,
      os: client.os,
      boot_time: client.boot_time,
      gpu_name: client.gpu_name,
      gpu_info: client.gpu_info,
      ipv4: client.ipv4,
      ipv6: client.ipv6,
      region: client.region,
      remark: client.remark,
      public_remark: client.public_remark,
      mem_total: client.mem_total,
      swap_total: client.swap_total,
      disk_total: client.disk_total,
      version: client.version,
      weight: client.weight,
      price: client.price,
      price_configured: client.price_configured,
      billing_cycle: client.billing_cycle,
      auto_renewal: client.auto_renewal,
      currency: client.currency,
      expired_at: client.expired_at,
      group: client.group,
      tags: client.tags,
      hidden: client.hidden,
      traffic_limit: client.traffic_limit,
      traffic_limit_type: client.traffic_limit_type as TrafficLimitType,
      created_at: client.created_at,
      updated_at: client.updated_at,
      // Status 默认值
      online: false,
      time: '',
      cpu: 0,
      gpu: 0,
      ram: 0,
      swap: 0,
      load: 0,
      load5: 0,
      load15: 0,
      temp: 0,
      disk: 0,
      net_in: 0,
      net_out: 0,
      net_total_up: 0,
      net_total_down: 0,
      net_monthly_up: 0,
      net_monthly_down: 0,
      process: 0,
      connections: 0,
      connections_udp: 0,
      uptime: 0,
      ping: undefined,
    }
  }

  /**
   * 更新节点的状态数据
   */
  function updateNodeStatus(node: NodeData, status: StatusData): NodeData {
    return {
      ...node,
      mem_total: status.ram_total && status.ram_total > 0 ? status.ram_total : node.mem_total,
      swap_total: status.swap_total !== undefined ? status.swap_total : node.swap_total,
      disk_total: status.disk_total && status.disk_total > 0 ? status.disk_total : node.disk_total,
      online: status.online,
      time: status.time,
      cpu: status.cpu,
      gpu: status.gpu,
      ram: status.ram,
      swap: status.swap,
      load: status.load,
      load5: status.load5,
      load15: status.load15,
      temp: status.temp,
      disk: status.disk,
      net_in: status.net_in,
      net_out: status.net_out,
      net_total_up: status.net_total_up,
      net_total_down: status.net_total_down,
      net_monthly_up: status.net_monthly_up,
      net_monthly_down: status.net_monthly_down,
      process: status.process,
      connections: status.connections,
      connections_udp: status.connections_udp,
      uptime: status.uptime,
      ping: status.ping,
      pingSample: status.pingSample,
      pingSampleKeys: status.pingSampleKeys,
      pingUpdates: status.pingUpdates,
    }
  }

  /**
   * 从 NodeStatus 提取状态数据
   */
  function extractStatusData(status: NodeStatus): StatusData {
    return {
      online: status.online,
      time: status.time,
      cpu: status.cpu,
      gpu: status.gpu,
      ram: status.ram,
      ram_total: status.ram_total,
      swap_total: status.swap_total,
      disk_total: status.disk_total,
      swap: status.swap,
      load: status.load,
      load5: status.load5,
      load15: status.load15,
      temp: status.temp,
      disk: status.disk,
      net_in: status.net_in,
      net_out: status.net_out,
      net_total_up: status.net_total_up,
      net_total_down: status.net_total_down,
      net_monthly_up: status.net_monthly_up,
      net_monthly_down: status.net_monthly_down,
      process: status.process,
      connections: status.connections,
      connections_udp: status.connections_udp,
      uptime: status.uptime,
      ping: status.ping,
      pingSample: status.pingSample,
      pingSampleKeys: status.pingSampleKeys,
      pingUpdates: status.pingUpdates,
    }
  }

  /** 当前配置下的窗口桶长（毫秒）；points/hours 无效时回退默认值 */
  function pingHistoryBucketMs(): number {
    const { points, hours } = pingHistoryConfig.value
    return Math.max(1, Math.round(hours * 3_600_000 / points))
  }

  /**
   * 按后端配置调整 ping 历史摄取策略：showThreeNetDetails 决定是否消费窗口，points/hours 决定桶长与保留条数。
   * 缺省字段保持默认值（兼容旧后端）。
   */
  function configurePingHistory(config: Partial<PingHistoryConfig>): void {
    const points = config.points === undefined
      ? pingHistoryConfig.value.points
      : Number.isFinite(config.points) && config.points > 0
        ? Math.min(240, Math.max(1, Math.round(config.points)))
        : PING_HISTORY_DEFAULTS.points
    const hours = config.hours === undefined
      ? pingHistoryConfig.value.hours
      : Number.isFinite(config.hours) && config.hours > 0
        ? Math.min(24, Math.max(0.5, config.hours))
        : PING_HISTORY_DEFAULTS.hours
    pingHistoryConfig.value = {
      showThreeNetDetails: config.showThreeNetDetails ?? PING_HISTORY_DEFAULTS.showThreeNetDetails,
      points,
      hours,
    }
  }

  function noteProbeHeartbeat(uuid: string, time: number): void {
    if (Number.isFinite(time) && time > 0 && time <= Date.now() + 120_000)
      pingObservedThroughByUuid.value[uuid] = Math.max(pingObservedThroughByUuid.value[uuid] ?? 0, time)
  }

  /** Keep every changed metric. A partial update never clears the other metric or carrier. */
  function recordPingUpdates(uuid: string, time: number, updates: Record<string, PingLineUpdate>, force = false): void {
    const now = Date.now()
    if (!Number.isFinite(time) || time <= 0 || time > now + 120_000 || time < now - pingHistoryHours.value * 3_600_000 - 15 * 60_000)
      return
    const history = trimPingHistory(livePingHistoryByUuid.value[uuid] ?? [])
    const exact = history.find(point => Date.parse(point.time) === time)
    const lines: Record<string, PingLineUpdate> = {}
    for (const key of PROBE_KEYS) {
      const incoming = updates[key]
      if (!incoming)
        continue
      const update: PingLineUpdate = {}
      for (const metric of ['latency', 'loss'] as const) {
        if (!Object.hasOwn(incoming, metric))
          continue
        const numeric = probeNumber(incoming[metric])
        const value = metric === 'loss' && numeric !== null && numeric > 100 ? null : numeric
        if (exact?.lines?.[key] && Object.hasOwn(exact.lines[key]!, metric) && exact.lines[key]![metric] === value)
          continue
        let previous: PingWindowPoint | undefined
        if (!force) {
          for (let index = history.length - 1; index >= 0; index--) {
            const candidate = history[index]!
            if (Date.parse(candidate.time) < time && candidate.lines?.[key] && Object.hasOwn(candidate.lines[key]!, metric)) {
              previous = candidate
              break
            }
          }
          if (previous?.lines?.[key]?.[metric] === value && time - Date.parse(previous.time) < 60_000)
            continue
        }
        update[metric] = value
      }
      if (Object.keys(update).length)
        lines[key] = { ...exact?.lines?.[key], ...update }
    }
    if (!Object.keys(lines).length)
      return
    const point: PingWindowPoint = { time: new Date(time).toISOString(), latency: null, loss: null, lines: { ...exact?.lines, ...lines } }
    livePingHistoryByUuid.value[uuid] = (exact ? history.map(old => old === exact ? point : old) : [...history, point])
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      .slice(-16000)
    schedulePingCache()
  }

  function seedPingSamples(uuid: string, points: readonly PingWindowPoint[], preserveAll = true): void {
    for (const point of points)
      recordPingUpdates(uuid, Date.parse(point.time), point.lines ?? {}, preserveAll)
  }

  function recordPingSample(uuid: string, status: NodeStatus): void {
    if (!status.online)
      return
    noteProbeHeartbeat(uuid, Date.parse(status.time))
    if (status.pingSample === false)
      return
    recordPingUpdates(uuid, Date.parse(status.time), status.pingUpdates ?? {})
  }

  /**
   * Earth 视图共享采样快照，避免 globe / maps 各自维护定时器。
   */
  function refreshEarthNodes(force = false): void {
    const now = Date.now()
    if (!force && now - lastEarthSnapshotAt < EARTH_SNAPSHOT_INTERVAL_MS)
      return

    earthNodes.value = [...nodes.value]
    lastEarthSnapshotAt = now
  }

  /**
   * 初始化节点数据（首次加载）
   */
  function initNodes(clients: Record<string, Client>, statuses: Record<string, NodeStatus>): void {
    const uuids = Object.keys(clients)
    hydratePingCache(uuids)
    const existingUuids = new Set(nodes.value.map(n => n.uuid))

    // 更新现有节点或添加新节点
    uuids.forEach((uuid) => {
      const client = clients[uuid]
      if (!client)
        return

      const status = statuses[uuid]
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (existingUuids.has(uuid) && index !== -1) {
        // 更新现有节点
        const baseNode = createNodeFromClient(client)
        const existing = nodes.value[index]!
        const fresh = status && Date.parse(status.time) >= Date.parse(existing.time)
        nodes.value[index] = updateNodeStatus(baseNode, fresh
          ? extractStatusData(status)
          : {
              ...existing,
              ram_total: existing.mem_total,
              swap_total: existing.swap_total,
              disk_total: existing.disk_total,
            })
      }
      else {
        // 添加新节点
        const newNode = createNodeFromClient(client)
        nodes.value.push(status
          ? updateNodeStatus(newNode, extractStatusData(status))
          : newNode,
        )
      }

      if (status) {
        if (pingHistoryConfig.value.showThreeNetDetails && status.pingWindow?.length)
          pingHistoryByUuid.value[uuid] = trimPingHistory(status.pingWindow)
        else
          pingHistoryByUuid.value[uuid] = trimPingHistory(pingHistoryByUuid.value[uuid] ?? [])
        recordPingSample(uuid, status)
      }
    })

    // 移除不存在的节点
    const newUuids = new Set(uuids)
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
        delete pingHistoryByUuid.value[node.uuid]
        delete livePingHistoryByUuid.value[node.uuid]
        delete pingObservedThroughByUuid.value[node.uuid]
      }
    }

    // 按 weight 降序排序（weight 越大越靠前）
    sortNodesByWeight()
    refreshEarthNodes(true)
  }

  /**
   * 按 weight 升序排序节点（weight 越小越靠前）
   */
  function sortNodesByWeight(): void {
    nodes.value.sort((a, b) => a.weight - b.weight)
  }

  /**
   * 更新节点状态（实时更新）
   */
  function updateNodeStatuses(statuses: Record<string, NodeStatus>, trackPing = true): void {
    let hasChanges = false

    Object.entries(statuses).forEach(([uuid, status]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)
      if (index === -1)
        return

      const node = nodes.value[index]
      if (!node || Date.parse(status.time) < Date.parse(node.time))
        return

      nodes.value[index] = updateNodeStatus(node, extractStatusData(status))
      if (trackPing)
        recordPingSample(uuid, status)
      hasChanges = true
    })

    if (hasChanges)
      refreshEarthNodes()
  }

  /**
   * 更新节点基本信息
   */
  function updateNodeClients(clients: Record<string, Client>): void {
    const newUuids = new Set(Object.keys(clients))

    // 更新现有节点信息或添加新节点
    Object.entries(clients).forEach(([uuid, client]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (index !== -1) {
        // 更新现有节点，保留状态信息
        const currentNode = nodes.value[index]
        if (!currentNode)
          return

        const baseNode = createNodeFromClient(client)
        nodes.value[index] = updateNodeStatus(baseNode, {
          online: currentNode.online,
          time: currentNode.time,
          cpu: currentNode.cpu,
          gpu: currentNode.gpu,
          ram: currentNode.ram,
          swap: currentNode.swap,
          load: currentNode.load,
          load5: currentNode.load5,
          load15: currentNode.load15,
          temp: currentNode.temp,
          disk: currentNode.disk,
          net_in: currentNode.net_in,
          net_out: currentNode.net_out,
          net_total_up: currentNode.net_total_up,
          net_total_down: currentNode.net_total_down,
          net_monthly_up: currentNode.net_monthly_up,
          net_monthly_down: currentNode.net_monthly_down,
          process: currentNode.process,
          connections: currentNode.connections,
          connections_udp: currentNode.connections_udp,
          uptime: currentNode.uptime,
          ping: currentNode.ping,
          pingSample: currentNode.pingSample,
          pingSampleKeys: currentNode.pingSampleKeys,
          pingUpdates: currentNode.pingUpdates,
        })
      }
      else {
        // 添加新节点（不带状态）
        nodes.value.push(createNodeFromClient(client))
      }
    })

    // 移除不存在的节点
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // 按 weight 降序排序
    sortNodesByWeight()
    refreshEarthNodes(true)
  }

  /**
   * 更新 WebSocket 连接状态
   */
  function updateWsState(state: WsConnectionState, attempts?: number): void {
    wsConnectionState.value = state
    if (attempts !== undefined) {
      wsReconnectAttempts.value = attempts
    }
  }

  /**
   * 清空所有节点数据
   */
  function clearNodes(): void {
    nodes.value = []
    pingHistoryByUuid.value = {}
    livePingHistoryByUuid.value = {}
    pingObservedThroughByUuid.value = {}
    savePingCache()
    refreshEarthNodes(true)
  }

  return {
    // 状态
    nodes,
    earthNodes,
    pingHistoryByUuid,
    livePingHistoryByUuid,
    pingHistoryHours,
    pingHistoryStepMs,
    pingObservedThroughByUuid,
    wsConnectionState,
    wsReconnectAttempts,
    // 计算属性
    onlineCount,
    totalCount,
    groups,
    nodesByUuid,
    showThreeNetDetails,
    // 方法
    initNodes,
    updateNodeStatuses,
    recordPingSample,
    recordPingUpdates,
    seedPingSamples,
    noteProbeHeartbeat,
    configurePingHistory,
    updateNodeClients,
    sortNodesByWeight,
    updateWsState,
    clearNodes,
    savePingCache,
  }
})

export { useNodesStore }
