# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的自用三网主题。当前版本 **v1.2.16**，只修改主题，不修改后端、探针或服务器，也不自动切换线上设置。

## 安装 / 升级

后台主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/f4b3ff5ce5b78fa10fa6dcba5ca5997043a27fe1
```

也可刷新后台，在 **Emerald · 自用三网版** 加载并选择新版。商店绑定 `build`，无需重新添加，但已应用的旧 SHA 不自动更新。

源码在 `custom`，产物在 `build`，滚动地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

## v1.2.16 丢包口径修复

直接移植 [LuminaPlus v1.2.24（391dc27）](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus/tree/391dc27f4ba21067afdfc3b20a4f03cde60919a6) 核心。旧版独立指标覆盖时长积分与它的采样 / 分桶 / 计权规则不完全等价。

- 完整快照按参考规则采样：变化 5 秒下限、稳定时 120 秒心跳、192 个统计样本。
- 实测覆盖优先，窗口只补缺口；15 秒一份的时长权重。
- 桶中点投影、短事件归桶、时长延续、边缘处理和最终按桶权重求丢包率全部对齐。
- 保留小数丢失量，不把百分比先取整；不是简单平均 20 个百分比。
- 时钟与权重刷新时机适配参考；丢包数字同样保留一位小数，内部真实比例不归零。

新标准统计缓存与旧增量缓存隔离。原始变化仍留作明细，历史请求仍复用回填，不增加首页逐节点历史查询。

同源同一浏览器可只读复用 LuminaPlus 已有真实历史，其连续覆盖区间优先，避免重复样本混入。存储事件和回前台同步，**不改写或删除原版缓存**。

对照使用独立的参考采样 / 分桶函数，180 帧、403 条实际推送样本回放中，采样一致、三网每格和最终丢包率差值为 0。不同浏览器、打开时刻、已有缓存仍可能不同；该结果限定为同输入、同窗口、同时间，不假造不存在的历史。

## 显示要求保持不变

每根柱子只按平均值显示一种颜色，该红就红、该黄就黄，不叠加红点、色帽或峰值。卡片 / 列表一致。点柱子只显示线路、时间范围与平均值。

三网两块面板、20 格、默认 2 小时；支持滑动切换、抬手保留 2.5 秒、悬停与键盘操作。其余卡片区域进入详情页。

增量字段合并、原始样本保留、视口定位、指针清理、完整历史、请求共享 / 超时重试等既有修复仍保留。名称、显示开关、背景、公告、价格配置保持兼容，配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

无兼容缓存时由后端窗口和新数据起步，未运行页面的历史无法凭空补回。极小非零丢包按参考一位小数可能显示 `0.0%`，仅为格式舍入。隐私模式 / 配额不足时刷新后不保证保存。

## 开发与许可

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物 `dist/`，Actions 发布到 `build`，不自动应用到用户 CFSM。代码、类型、构建、公开静态资源与参考对照已核对。

核心文件 `src/utils/luminaProbe.ts`，保留参考 MIT 许可和作者署名。[LICENSE](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
