# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的 CF Server Monitor 自用三网主题。当前版本 **v1.2.16**。

只修改主题，不修改后端、探针或服务器，不自动应用到线上。保持每根柱子按平均值显示单一颜色，没有峰值红点、色帽或双色叠加。

## 安装 / 升级

后台 → 主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/f4b3ff5ce5b78fa10fa6dcba5ca5997043a27fe1
```

也可刷新后台，在 **Emerald · 自用三网版** 加载版本、选择新版并切换。旧固定 SHA 不会自动更新。

源码在 `custom`，产物在 `build`，`main` 保留上游基线和说明。滚动地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

商店绑定 `build`，发版后无需重新添加条目。固定 SHA 推荐使用，避免分支资源缓存混用。

## v1.2.16：丢包统计对齐 LuminaPlus

参考 [CFSM-Theme-LuminaPlus v1.2.24（391dc27）](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus/tree/391dc27f4ba21067afdfc3b20a4f03cde60919a6)。

旧版 Emerald 使用独立指标覆盖时长积分；参考主题则采用完整探测快照、时长权重、桶中点投影，再按桶的样本份数计算丢包率。两套实现不完全等价，即使都叫“加权平均”，也可能得到不同数字。

本版直接移植参考核心规则：

- 完整线路快照采样：变化 5 秒下限、稳定时 120 秒心跳，按参考策略保留 192 个统计样本。
- 本地实测优先，后端窗口只补没有连续实测覆盖的时段。
- 样本代表时长按 15 秒一份计权，保持小数丢失量，不先把丢包百分比取整。
- 同样的时间延续、边缘处理、20 格桶中点投影和短事件归桶规则。
- 最终丢包率由这些柱子的有效样本权重计算，不简单平均 20 个百分比。
- 时钟初始时点、分钟刷新和权重重算时机按参考规则适配。
- 丢包数字按参考保留一位小数；内部仍保留真实百分比。极小非零值可能显示 `0.0%`，这是格式舍入，不是把原始丢包率改成 0。

原始增量记录继续供明细使用，新的标准统计缓存与旧缓存隔离，不混入旧口径。已有历史请求仍会复用回填，不新增首页逐节点历史查询。

## 浏览器历史与对照限制

同源同一浏览器中，LuminaPlus 已有的真实缓存只读复用，其连续覆盖区间优先，不叠加旧采样重复计权。存储事件及回到前台时同步读取，**不写入、不删除原版缓存**。

无兼容缓存时，从后端窗口和新收到的真实数据开始。不同浏览器、域名、打开时间或已有历史不同，输入本身仍可能不同；主题无法凭空补回未采集的历史。对比时应确认新版已应用并刷新页面。

验证使用独立读取的参考采样 / 分桶函数，180 帧、403 条实际推送样本的对照回放中，采样一致、三网每根丢包柱及最终丢包率差值为 0。这是同输入、同窗口、同时间条件下的结果，不声称所有浏览器过去的缓存都一样。

## 布局与保留功能

延迟 / 丢包两块面板，三网竖排；列表独立两列。默认 2 小时、每线 20 格，优先读取后端窗口。柱子始终是平均值的纯色，不显示任何额外峰值。

点柱子就地显示线路、时间范围、平均值，横向滑动切换，抬手保留 2.5 秒。支持悬停、方向键、Home、End、Esc，其他卡片区域进入详情。

保留增量字段独立合并、原始消息变化记录、紧凑缓存、页面隐藏 / 关闭保存、聚合快照同步、完整多线路历史、历史请求共享和超时重试、手机视口气泡定位等修复。

缺测不伪装成零；真实整轮失败仍按实际数据处理。后台名称 / 显示开关、背景、公告、价格配置保持兼容，配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发与许可

`custom` 分支，Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物为 `dist/`；Actions **Publish Three-Net Theme** 更新 `build`，不会修改用户当前主题设置。代码 / 类型 / 构建、公开资源和参考对照已核对。

核心移植文件 `src/utils/luminaProbe.ts`，保留参考项目 MIT 许可和署名。[LICENSE](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
