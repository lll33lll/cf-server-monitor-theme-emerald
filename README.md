# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的自用三网主题。当前版本 **v1.2.18**，只修改主题，不修改后端、探针或服务器，不自动切换线上主题。

## 使用

后台主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/215f188f1c447ef217007cd3e919e5f4b37efb06
```

或刷新后台，在 **Emerald · 自用三网版** 加载新版。源码 `custom`，产物 `build`，旧 SHA 不会自动更新。

## v1.2.18 统计来源修复

旧版核心公式已对齐参考，但仍把自己额外的历史补进原版缓存缺口，导致实际输入不同。不是公式一致就必然是画面数值一致。

- 有有效原版缓存时，以该历史为基准，不再插入自有旧记录填其缺口。
- 仅追加晚于参考最后一条的新采样；没有可用参考时，正常使用自有采样和后端窗口。
- 自有数据继续保留在缓存 / 明细中，不删记录，不修改原版存储。
- 无关的自有历史回填不改变有效统计输入时，也不再刷新统计权重计算时刻。
- 诊断增加来源模式、参考截止时刻、旧历史排除数和新增尾部数。

实际文件回放已核对修正后的 20 格丢包和最终统计与同窗口参考缓存复算一致，存储未改。诊断数据没有公开入库。

仍不保证不同页面永远显示同一数字：缓存快照、统计时刻、新增尾部或另一页面未落盘内存不同，输入仍可能不同。不硬凑旧截图，不伪造数据。

## 保留的要求

核心采用 [LuminaPlus v1.2.24](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus/tree/391dc27f4ba21067afdfc3b20a4f03cde60919a6) 的采样、15 秒权重、桶中点投影和最终桶权重丢包率规则。

每根柱子只按平均值显示单一颜色，不加红点、峰值或混色。两块三网面板、20 格、默认 2 小时，卡片 / 列表一致。点柱子就地查看，滑动切换，抬手留 2.5 秒。

原始变化保留、字段合并、历史请求共享、缓存及交互修复保留。已有历史查询继续回填，无新增逐节点历史轮询。

顶部 **“导出丢包诊断”** 只读导出白名单探测数据，不含密码、Token / Cookie、API Secret、节点 IP 或价格，不改缓存。参考复算不是另一页实时内存值。先别清缓存，不公开提交诊断文件。

## 开发与许可

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物 `dist/`，Actions 发布至 `build`，不改当前主题设置。代码 / 类型 / 构建、静态资源与实际文件回放已核对。

配置保持原版兼容，完整说明见 [上游 README](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。[LICENSE](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
