# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的自用三网主题，保留原版外观。当前版本 **v1.2.13**。

只修改主题，不修改 CFSM 后端、探针或服务器，不自动应用到线上。

## 使用 / 升级

后台主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/2d8a0915219d8127a778fa4846e429eddf61b0c6
```

私有商店 **Emerald · 自用三网版** 绑定 `build`，刷新后台、加载版本后可选择新版。商店条目无需重新添加，但已应用的旧 SHA 不会自动更新。

源码在 `custom`，产物在 `build`；滚动地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

固定 SHA 推荐使用，后端通常缓存分支 1 小时、SHA 24 小时。最新地址同时记在 [main README](https://github.com/lll33lll/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 布局

延迟 / 丢包两块面板，面板内分别竖排电信、联通、移动，列表独立两列。每条线路 20 格，优先读取后台窗口时长，默认 2 小时。

点柱子就地显示时间与数值，滑动切换，抬手留 2.5 秒，气泡和高亮同步复位；不会弹曲线卡片。支持悬停和键盘左右方向键、Home、End、Esc。其他卡片区域进入详情页。

## v1.2.13

- **均值与峰值**：数字、柱身仍展示窗口 / 每格均值；顶部小色标提示更高色档的真实峰值，气泡同时显示平均和峰值。不把峰值冒充平均值，不调整 60 / 120 / 180 / 240 ms 的阈值，不强制锁红。
- 所有卡片 / 列表共享整分钟时间轴，切换视图不改变分桶相位。
- WS 延迟与丢包按字段独立合并，省略字段不清空另一项；显式缺测 / 禁用不补 0。
- 消息接收时立即累积真实探测变化，与一秒视觉播放解耦，批次中间样本不再丢失；移除变化采样的旧 20 秒门槛，重复值压缩。
- 状态延续只到实际收到的心跳，不当成新探测，不无限填跨关闭页面 / 离线缺口。
- 紧凑 v2 缓存兼容旧版有效样本，保留窗口外 15 分钟；隐藏 / 关闭页面及时保存。
- 只读接续同一浏览器、同源 LuminaPlus 的已有真实缓存，不修改、删除其存储；不同浏览器 / 域名仍独立。
- 每 5 分钟同步现有聚合服务器快照，重连 / 回前台同步；首页不新增逐节点历史轮询。
- 详情曲线保留所选时间窗，不再把 8 条线路共用历史截为合计 500 条。
- 资源与 Ping 图复用同档历史请求，并用已经请求的历史回填探测缓存。
- 资源历史不再合成 15 分钟空槽，缺失的历史流量计数保持缺测而非 0。
- 旧请求响应不覆盖新节点 / 新档位图表；增量资源省略字段不造成 CPU、内存、速率清零；有效硬件总量同步更新，旧快照不使实时状态倒退。

## 语义与限制

数字按有效覆盖时间加权，不混算三网，不简单平均 20 个百分比。缺测为 `—` / 灰柱，真实 100% 丢包为红柱、延迟缺测，极小非零丢包显示 `<0.1%`。

时间窗滚动，过窗的旧事件会自然退出；后端抽样、页面未运行时的缺口无法由主题凭空补回。可用历史并非完整逐包历史。隐私模式 / 配额不足时内存采样仍工作，但刷新后不保证保留。

支持自定义线路名称和后台显示开关；关闭三网详情时显示实时数字、不画历史柱。原版背景、公告、价格等配置保持兼容，完整配置 JSON 见 [上游 README](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物为 `dist/`；Actions **Publish Three-Net Theme** 更新 `build`。代码 / 类型 / 构建、静态依赖和真实推送回放已核对；不替代用户浏览器实际验证。

## 来源与许可

[MIT](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
