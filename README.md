# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的自用三网主题。当前版本 **v1.2.14**，只修改主题，不修改 CFSM 后端、探针或服务器，也不自动应用到线上。

## 使用 / 升级

后台主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/50affe93d93ad21ed987951af94524f6d9c4956e
```

私有商店 **Emerald · 自用三网版** 绑定 `build`，刷新后台、加载版本后可选择新版。商店条目无需重加，已应用的旧 SHA 不会自动更新。

源码在 `custom`，产物在 `build`：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

固定 SHA 推荐使用，后端通常缓存分支 1 小时、SHA 24 小时。最新地址同时记录在 [main README](https://github.com/lll33lll/cf-server-monitor-theme-emerald/blob/main/README.md)。

## v1.2.14

- **黄柱上方一点红**是峰值标记：柱身表示均值，点表示更高色档的峰值。比如平均 238 ms、峰值 241 ms，主体黄色、顶部点红色；同色档不重复标点。
- 色帽改为与柱身分离的小点，新增图例。柱身选中放大不再连带拉动峰值点；气泡里继续显示平均与峰值。
- 气泡按手机实际可见视口限制宽度和位置，缩放 / 滚动 / 视口变化时收起，防止残留在旧位置。
- 定位按每帧合并，减少重复测量；补齐 Esc、指针捕获释放和组件卸载清理。
- 历史请求未完成时共享；15 秒缓存从成功完成起算，旧失败请求不删除新缓存，30 秒超时后可重试。
- 异常历史行 / 不合理时间戳忽略，不污染曲线。

**本版没有改变延迟 / 丢包统计算法、240 ms 红色分界或样本缓存口径，只修可读性与交互、请求稳定性。**

## 三网布局与数据

- 延迟、丢包两块面板，各自三网竖排；列表独立两列，每条线路 20 格，默认 2 小时，优先读取后端窗口。
- 所有卡片 / 列表共享整分钟时间轴；点柱子就地看时间与数值、滑动切换，抬手保留 2.5 秒，气泡 / 高亮同步复位。支持悬停与左右方向键、Home、End、Esc。
- v1.2.13 的独立字段合并、接收时即时采样、完整批次变化保留仍保留；不把省略字段变成 0，不依赖视觉播放才记历史。
- 均值按覆盖时间加权，峰值独立标注，不混算三网、不简单平均 20 个百分比。
- 紧凑 v2 缓存兼容旧版有效样本，保留窗口外 15 分钟，隐藏 / 关闭页面及时保存。
- 同源同一浏览器只读接续 LuminaPlus 已有真实缓存，不写入、不删除其数据；不同浏览器 / 域名仍独立。
- 每 5 分钟同步现有聚合快照，重连 / 回前台同步；首页不新增逐节点历史轮询。
- 详情曲线不再用 500 条总上限裁掉多线路历史。资源与 Ping 复用同档请求，用已有历史回填探测缓存。
- 资源图不造 15 分钟空槽，缺失历史流量不补 0；旧请求不覆盖新节点 / 新档位，增量资源不清零省略字段。

## 语义与限制

缺测为 `—` / 灰柱，真实 100% 丢包红柱、延迟缺测，极小非零丢包显示 `<0.1%`。丢包色阶仍为 0% 绿、3% 黄、10% 橙、30% 及以上红。

时间窗口滚动、旧事件过窗时，标记正常退出；后台抽样和未运行页面时的缺口无法凭空补回。可用历史不是完整逐包历史。隐私模式 / 配额不足时内存仍采样，刷新后不保证保留。

支持自定义线路名和后台显示开关；关闭三网详情时显示实时数字、不画柱子。背景、公告、价格等保持原版兼容，配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物在 `dist/`。Actions **Publish Three-Net Theme** 发布到 `build`，不会修改用户当前主题设置。

本版代码 / 类型 / 构建、静态依赖、请求共享 / 超时重试 / 异常历史、视口边界已核对；仍需在用户浏览器实际验证。

## 来源与许可

[MIT](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
