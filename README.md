# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的 CF Server Monitor 自用三网主题。当前版本 **v1.2.15**。

只修改主题，不修改 CFSM 后端、探针或服务器，也不会自动切换线上主题。

## 安装 / 升级

后台 → 主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/2497e1eb66e1eeec78bc4a58dc6a6916aa16934c
```

也可刷新后台，在 **Emerald · 自用三网版** 中加载版本、选择新版并切换。已应用的旧 SHA 不会自动更新。

源码在 `custom`，安装产物在 `build`，`main` 保留上游基线和使用说明。滚动构建地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

商店始终读取 `build` 的构建提交，条目不需要重新添加。后端通常缓存分支约 1 小时、固定 SHA 约 24 小时，升级建议使用新 SHA，避免旧资源混用。

## v1.2.15：只显示平均值，单柱单色

- **每根柱子只由这一格的平均值决定一种颜色**：该红就红、该黄就黄，不叠加其他颜色。
- 已删除额外的峰值计算、红点、色帽、双色标记及相关图例；不保留隐藏开关。
- 点柱子只显示线路、该格时间范围和对应指标平均值，不显示额外峰值。
- 延迟色阶仍为 60 / 120 / 180 / 240 ms，不改阈值，不强制锁色。
- 卡片与列表统一使用这一套显示；选中只放大该纯色柱子，不改变它的颜色。
- 此次只撤除额外显示，已修好的采样、缓存、历史请求和交互全部保留。

## 布局与数据

延迟 / 丢包两块面板，各自竖排电信、联通、移动；列表独立两列。每条线路 20 格，优先读取后台窗口时长，默认 2 小时。数字按有效覆盖时间加权计算，不混算运营商、不简单平均 20 个百分比。

所有卡片与列表共用整分钟时间轴。点柱子就地显示数值，横向滑动切换，抬手保留 2.5 秒，气泡与高亮同步复位；不弹历史曲线卡片。支持鼠标悬停、方向键、Home、End、Esc；其他卡片区域进入详情。

缺测为 `—` / 灰柱，真实 100% 丢包红柱、延迟缺测，极小非零丢包显示 `<0.1%`。丢包色阶为 0% 绿、3% 黄、10% 橙、30% 及以上红，每格内部仍是单一颜色。

## 保留的稳定性修复

- WS 延迟与丢包独立合并，省略字段不清空另一项；消息接收时记录真实变化，与页面播放解耦，不漏批次中间样本。
- 紧凑 v2 缓存兼容旧版有效样本，保留窗口外 15 分钟；隐藏 / 关闭页面及时保存。同源同一浏览器可只读接续 LuminaPlus 的已有真实缓存，不修改其存储。
- 每 5 分钟同步现有聚合服务器快照，重连 / 回前台同步；首页不新增逐节点历史轮询。
- 详情多线路历史不再共用 500 条总上限；资源与 Ping 图复用同档历史，并用已有记录回填探测缓存。
- 资源历史不造 15 分钟空槽，缺失流量不补 0；旧请求不覆盖新节点 / 新档位，增量资源不误清零。
- 气泡按实际可见视口定位，滚动 / 缩放时收起；定位按每帧合并，指针和键盘状态完整清理。
- 历史慢请求共享、成功完成后缓存、30 秒超时可重试；异常历史记录不污染图表。

## 限制与兼容

窗口滚动、样本过期后数据自然退出，不人为保留旧颜色。后台抽样或页面未运行时的缺口无法凭空补回，可用历史不是完整逐包历史。隐私模式 / 配额不足时内存仍工作，但刷新后不保证保留。不同浏览器、域名仍独立。

支持后台自定义线路名与显示开关；关闭三网详情时显示实时数字、不画柱子。背景、公告、价格等保持原版兼容，完整配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发

`custom` 分支，Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物在 `dist/`，Actions **Publish Three-Net Theme** 更新 `build`，不会自动应用到用户的 CFSM。本版构建和静态依赖已核对，安装源码中已确认不存在柱子的额外峰值标记和双色叠加。

## 来源与许可

[MIT](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
