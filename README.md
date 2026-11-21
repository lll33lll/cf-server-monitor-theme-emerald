# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的自用三网主题。当前版本 **v1.2.17（只读诊断版）**。

不修改后端、探针或服务器，不自动切换线上主题。保持纯色平均值柱子，没有峰值红点或混色。

## 使用

后台主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/719b0b095f4e3cdc0dcb267ec7ddac6468a2b1ae
```

或刷新后台，在 **Emerald · 自用三网版** 加载并选择新版。源码在 `custom`，产物在 `build`。旧 SHA 不自动更新。

## 导出浏览器真实丢包输入

本版只增加顶部 **“导出丢包诊断”下载图标**，不修改现有采样、缓存和丢包计算，也不宣称实际差异已修复。

两页仍有差异时，在 Emerald 首页点击图标，把生成的 `emerald-loss-diagnostic-*.json` 发给维护者。**先不要清缓存，不要公开提交诊断文件。**

文件记录实际构建号、画面已渲染数值、时钟、权重计算时刻、后端窗口、自己的统计样本、原版持久化缓存、合并输入、每格计算结果和原版缓存复算结果。

只含白名单探测数据，不含密码、JWT / Cookie、API Secret、节点 IP 或价格，导出不写入或删除缓存。

参考复算仅使用已持久化的原版样本和本页窗口，**不等于另一标签页实时内存里正在显示的数字**。其未落盘历史无法直接读取。

## 保留的规则

v1.2.16 移植 [LuminaPlus v1.2.24（391dc27）](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus/tree/391dc27f4ba21067afdfc3b20a4f03cde60919a6) 的快照采样、5 秒变化 / 120 秒心跳、192 样本、15 秒权重、桶中点投影和最终按桶权重计丢包率。

同输入回放一致不意味着浏览器实际输入一致，本版用于采集这部分真实证据。原版已有同源真实缓存只读接续，不修改它的数据。旧增量缓存供明细，新统计缓存与旧口径分离。

延迟 / 丢包两块三网面板，列表独立两列；20 格、默认 2 小时，每格单一平均值颜色。点柱子就地查看、滑动切换，抬手留 2.5 秒，气泡 / 高亮同步复位。已有历史查询复用回填，不新增逐节点历史轮询。

丢包一位小数，内部真实值不归零。窗口、时刻、浏览器历史不同仍可能产生差异，缺失历史不凭空补齐。配置保持兼容，完整 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发与许可

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物 `dist/`，Actions 发布至 `build`，不修改当前在线主题。本版代码 / 类型 / 构建、静态依赖及诊断只读、凭据不导出已核对。

[LICENSE](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
