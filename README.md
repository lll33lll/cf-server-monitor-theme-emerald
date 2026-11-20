# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 改造的 CF Server Monitor 主题。保留原版外观，电信、联通、移动独立显示延迟和丢包。当前版本 **v1.2.13**。

只修改主题，不修改 CFSM Worker、探针或服务器配置，也不自动切换线上主题。

## 安装 / 升级

后台 → 主题商店 → 自定义主题 URL，填入固定版本：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/2d8a0915219d8127a778fa4846e429eddf61b0c6
```

也可在你自己的主题商店找到 **Emerald · 自用三网版**，刷新后台、加载版本，选择新版再切换。

滚动构建地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

- 源码在 [`custom`](https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/custom)，安装产物在 `build`；`main` 保留上游基线与本说明。
- `build` 含 `index.html`、`assets/`、许可和版本元数据。不要填写源码分支。
- 商店读取 `build` 的最新构建提交，不需要重复添加条目；已经应用的固定 SHA 不会自动更新。
- 后端通常缓存分支约 1 小时、固定 SHA 约 24 小时。升级时建议换新 SHA，避免旧资源混用。

## 布局与交互

- 卡片：延迟、丢包两块面板，分别竖排电信 / 联通 / 移动；列表是独立的三网延迟、三网丢包列。
- 每条线路 20 格，窗口优先读 `/api/config.latency_window.hours`，默认 2 小时。
- 所有卡片、列表共用整分钟时间轴，切换视图不会改变分桶相位。
- 点柱子显示该格时间范围与数值，横向滑动切换，抬手保留 2.5 秒，气泡与高亮同步复位。气泡独立渲染，不被卡片裁切。
- 鼠标支持悬停，键盘支持左右方向键、Home、End、Esc；卡片其他区域进入详情页。

## v1.2.13 修复

### 均值与峰值不混用

- 延迟数字仍为近窗口平均值；柱身颜色仍由该格平均延迟决定。
- **顶部小色标单独提示更高色档的真实峰值**，点柱子同时显示平均值与峰值。比如平均 238 ms、峰值 241 ms，主体黄色、顶部红色；不会把峰值冒充成平均延迟。
- 不调整阈值、不强制锁红：60 / 120 / 180 / 240 ms 的延迟色阶保持不变。
- 时间窗口滚动、旧事件移出窗口时，标记正常退出。后台抽样、未打开页面时的缺口不能由主题凭空还原。

### 增量数据与缓存

- WS 的延迟、丢包按字段分别合并；省略字段不再误清空另一项。显式 null / false 仍保持缺测 / 禁用语义。
- 接收消息时立即记录真实探测变化，与一秒页面播放解耦；批次中间样本不再被播放队列覆盖或漏记。
- 变化无旧版 20 秒采样门槛；重复值压缩，状态延续只到实际收到的心跳，不作为新探测，也不跨关闭页面 / 离线缺口无限填充。
- 使用紧凑 v2 缓存，保留窗口外 15 分钟衔接；兼容旧版有效样本。页面隐藏、关闭时及时保存。
- 同源、同一浏览器存在 LuminaPlus 缓存时，只读接续其已有真实样本，**不写入、不删除它的缓存**。不同浏览器、域名仍互相独立。
- 每 5 分钟同步一次现有聚合 `/api/servers` 快照，重连 / 回到前台时同步；首页不新增逐节点历史轮询。

### 连带修复

- 详情多线路曲线不再把所有任务合计截成 500 条，保留各线路完整所选时间窗。
- 资源与 Ping 图同节点、同时间档共用历史请求，打开详情时复用已有历史记录回填探测缓存。
- 资源历史保留接口实际采样行，不再人为造 15 分钟空槽；未提供的历史流量计数保持缺测，不补 0。
- 快速切节点 / 时间档后，旧请求响应不覆盖新图表；增量资源更新不把省略的 CPU、内存、速率等字段变成 0。
- 硬件总量随有效上报更新；旧快照不使实时状态倒退。

## 数据语义

数字按同一窗口的有效覆盖时间加权计算，不混算运营商、不简单平均 20 个百分比。

无数据 `—` / 灰柱，真实 100% 丢包红柱、延迟缺测；非零且不足 0.1% 的丢包显示 `<0.1%`。丢包连续热力色：0% 绿、3% 黄、10% 橙、30% 及以上红。

保留后台自定义线路名称。关闭 `show_three_net_details` 时只显示实时三网数字；价格、背景、公告等原版配置保持兼容。完整配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

本地缓存只在页面运行时积累；隐私模式 / 存储配额限制下，内存采样仍工作但不能保证刷新后保留。可用历史不等于完整逐包历史。

## 开发与校验

切换 `custom`，Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物在 `dist/`；Actions **Publish Three-Net Theme** 发布至 `build`，不会自动应用到你的 CFSM。

本版通过代码检查、类型检查、生产构建、静态依赖核对，并用同一组真实推送回放核对字段合并、变化保留、缓存读写与历史请求复用。实际浏览器缓存无法通过远程 API 读取，因此不声称每个用户过去看到的差异都只有一个根因。

## 来源与许可

[MIT](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 和 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
