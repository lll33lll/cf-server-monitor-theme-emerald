# Emerald 三网定制主题

基于 [Tokinx/cf-server-monitor-theme-emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 改造的 CF Server Monitor 主题，保留 Emerald 原版风格，分别显示电信、联通、移动的延迟和丢包。

当前定制版本：**v1.2.12**。仅修改主题，不修改 CFSM Worker、探针或服务器配置。

## 直接使用

CFSM **后台 → 主题设置 → 自定义主题 URL**，填入以下固定版本地址并保存：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/da3c59046cedc22612367f62e8780687dfc82d62
```

固定版本不会自动变化，推荐使用。也可选择滚动构建地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

- **源码在 `custom` 分支**：[查看源码](https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/custom)。`main` 保留上游基线与本使用说明。
- **可安装产物在 `build` 分支**：含 `index.html`、`assets/`、`LICENSE`、`version.json`。不要把源码分支填进主题 URL。
- 后端通常缓存分支引用约 1 小时、固定 SHA 约 24 小时。升级时换成新 SHA，避免旧缓存混用。
- 后端需支持 GitHub 自定义主题 URL，并已有三网探测数据；主题无法生成后端未上报的数据。

## 改动

- **卡片**：延迟、丢包两块面板，各自按电信 / 联通 / 移动三行竖排，不再合并线路统计。
- **列表**：独立的三网延迟、三网丢包两列；手机可横向滚动。
- **历史柱**：每条线路 20 格。窗口优先读 `/api/config.latency_window.hours`，缺省为 2 小时；保留后端实际时间戳和采样粒度。
- **统计一致**：数字从同一组柱子的有效覆盖时间加权计算，不简单平均 20 个百分比，不混算其他线路。
- **真实数据**：直接保留 `/api/servers` 中分线路 `ping[]` / `loss[]`；首页不新增逐节点历史请求。
- **缓存与推送**：真实实时样本存入当前浏览器 localStorage，保留统计窗口外 15 分钟用于衔接；过滤旧推送，不把没有探测字段的资源更新当成新探测。
- **柱子交互（v1.2.12）**：参照 LuminaPlus，点柱子就地显示「线路 · 时间范围 · 当前指标数值」的小气泡，不再弹出历史曲线卡片或进入详情。横向滑动切换柱子，抬手保留 2.5 秒，气泡和柱子高亮同步复位；点击空白、页面滚动也会收起。点到柱子缝隙也能选中，卡片与列表共用同一套交互。
- **桌面与键盘**：鼠标悬停可查看；聚焦柱带后用左右方向键、Home、End 切换，Esc 收起。卡片其他区域仍进入节点详情，完整曲线保留在详情页。
- **名称与开关**：支持后台自定义线路名称；关闭 `show_three_net_details` 时只显示实时三网数值，不显示历史柱。
- **缺测**：无数据为 `—` / 灰柱；真实 100% 丢包为红柱、延迟 `—`；非零但不足 0.1% 的丢包显示 `<0.1%`。
- **配色**：丢包连续热力色，0% 绿 → 3% 黄 → 10% 橙 → 30% 及以上红；延迟沿用 Emerald 分档配色。

本地缓存只在页面打开时采集，不同浏览器、不同主题的旧缓存互不共享。刚切换主题时，不保证与其他主题已经累积的柱子逐根相同。历史是后端窗口加真实实时采样的可用覆盖，不代表额外采集了完整逐包历史。

## 开发与构建

切换到 `custom` 分支，使用 Node 24 与 Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物在 `dist/`。`custom` 的源码变更通过 Actions **Publish Three-Net Theme** 构建至 `build`，不自动修改你的 CFSM 在线主题设置。

主题配置 JSON、背景、公告和其他原版参数保持兼容，完整原版说明见 [上游 README](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

本次发布的代码检查、类型检查、生产构建已通过；已核对公开构建归档中的静态资源引用，无缺失相对依赖。这不替代在你的浏览器中实际使用后的验证。

## 致谢与许可

- [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)
- [CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus)
- [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)

[MIT](./LICENSE)
