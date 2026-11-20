# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的自用三网主题。当前版本 **v1.2.15**。

只修改主题，不修改 CFSM 后端、探针或服务器，不自动切换线上主题。

## 使用 / 升级

后台主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/2497e1eb66e1eeec78bc4a58dc6a6916aa16934c
```

也可刷新后台，在 **Emerald · 自用三网版** 加载并选择新版。旧固定 SHA 不会自动更新。

源码在 `custom`，安装产物在 `build`。滚动地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

最新固定地址也写在 [main README](https://github.com/lll33lll/cf-server-monitor-theme-emerald/blob/main/README.md)。后端通常缓存分支 1 小时、SHA 24 小时，升级建议换新 SHA。

## v1.2.15：平均值决定单一颜色

- 每根柱子只按这一格的平均延迟或平均丢包填一种颜色，不混色、不叠加其他颜色。
- 额外峰值计算、红点、色帽和相关说明全部删除，不保留隐藏开关。
- 气泡只显示线路、时间范围、对应指标平均值；卡片和列表一致。
- 延迟 60 / 120 / 180 / 240 ms 的分界保持不变，该红就红、该黄就黄。选中只放大纯色柱子，不改变颜色。
- 既有采样、缓存、历史请求、视口定位和交互修复保留，不回退到旧版漏样逻辑。

## 功能与数据

延迟 / 丢包两块面板，各自三网竖排，列表独立两列；每条线路 20 格，优先读取后端窗口，默认 2 小时。数字按覆盖时间加权，不混算三网，不简单平均 20 个百分比。

点柱子就地显示平均值，滑动切换，抬手留 2.5 秒，气泡与高亮同步复位；不弹曲线卡片。支持悬停、方向键、Home、End、Esc；其他卡片区域进入详情。

WS 指标按字段独立合并，变化在接收时立即记录，不依赖视觉播放。紧凑 v2 缓存保留窗口外 15 分钟，同源同一浏览器可只读接续 LuminaPlus 已有真实缓存，不修改、删除其数据。

每 5 分钟同步现有聚合快照，重连 / 回前台同步；首页不新增逐节点历史轮询。详情多线路不再共用 500 条总上限；资源与 Ping 图复用同档请求，用已有历史回填探测缓存。

历史资源缺失不补 0，不造 15 分钟空槽，旧请求不覆盖新节点 / 新档位。慢请求共享，缓存从成功完成计时，30 秒超时可重试；气泡、指针和键盘状态完整清理。

## 语义与限制

缺测为 `—` / 灰柱，真实 100% 丢包为红柱、延迟缺测，极小非零丢包显示 `<0.1%`。丢包热力色仍为 0% 绿、3% 黄、10% 橙、30% 及以上红，每格内部保持纯色。

窗口滚动、过期样本自然退出，不人为保留颜色。后台抽样、页面未运行时的缺口无法凭空补回。不同浏览器 / 域名独立，隐私模式 / 配额不足时刷新后不保证保留。

支持自定义线路名、后台显示开关，以及原版背景 / 公告 / 价格配置。关闭三网详情时仅显示实时数字。完整配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物在 `dist/`，Actions **Publish Three-Net Theme** 发布到 `build`，不会自动应用到用户 CFSM。本版代码 / 类型 / 构建与静态依赖已核对，额外标记与双色叠加已从柱子组件和数据模型移除。

## 来源与许可

[MIT](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
