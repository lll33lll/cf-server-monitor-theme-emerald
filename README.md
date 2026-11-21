# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的 CF Server Monitor 自用三网主题。当前版本 **v1.2.17（只读诊断版）**。

只修改主题，不修改后端、探针或服务器，不自动切换线上设置。每根柱子只按平均值显示单一颜色，没有红点、峰值或双色叠加。

## 安装 / 升级

后台 → 主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/719b0b095f4e3cdc0dcb267ec7ddac6468a2b1ae
```

也可刷新后台，在 **Emerald · 自用三网版** 加载并选择新版。旧固定 SHA 不会自动更新。

源码在 `custom`，产物在 `build`，滚动地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

## v1.2.17：采集浏览器实际输入，不改数字

本版新增顶部 **“导出丢包诊断”下载图标**。用于定位两个真实页面仍然存在的丢包率差异，**不是再次宣称差异已经修复**。

两个页面仍显示不同数字时，在 Emerald 首页点下载图标，将生成的 `emerald-loss-diagnostic-*.json` 发给维护者。先不要清缓存，也不要把诊断文件公开提交到 GitHub。

诊断包含：

- 实际构建版本、构建哈希、采集时刻和站点来源。
- 页面已渲染的三网数值、分桶时刻、权重计算时刻。
- 后端窗口、自己的统计样本、已读取的原版缓存、合并后的实际输入。
- 每格丢包率和权重，以及仅用原版持久化样本复算的参考结果。
- 原版缓存是否存在、保存时刻、记录格式长度等。

仅导出白名单探测数据，不包含账号密码、JWT / Cookie、API Secret、节点 IP 或价格。导出不改采样、缓存或现有统计结果，新增 DOM 属性只用于记录已经画在页面上的值。

**“仅原版缓存复算”不是另一标签页的实时显示值。** 另一页面内存里尚未持久化的样本无法直接读取，因此必须区分原始缓存、当前内存输入和画面数值。

## v1.2.16 的核心适配仍保留

采用 [LuminaPlus v1.2.24（391dc27）](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus/tree/391dc27f4ba21067afdfc3b20a4f03cde60919a6) 的完整快照采样、5 秒变化下限、120 秒稳定心跳、192 个统计样本、15 秒时长权重、桶中点投影和最终桶权重丢包率规则。

独立参考函数对同输入、同窗口、同时间的 403 条推送样本回放曾得到差值 0，但这**不能证明用户两个实际页面正在使用同一批输入**。v1.2.17 正是为了补齐浏览器真实运行证据。

同源、同一浏览器只读复用原版已有真实缓存，不修改或删除它的存储。旧原始增量缓存保留供明细，新的统计缓存不混入旧口径。已有历史请求继续复用回填，不新增首页逐节点历史查询。

## 布局与限制

延迟 / 丢包两块面板，三网竖排，列表独立两列；默认 2 小时、每线 20 格。点柱子就地显示时间与平均值，滑动切换，抬手保留 2.5 秒；不弹曲线卡片。支持悬停与键盘操作。

丢包数字保留一位小数，内部真实比例不归零。不同浏览器、时刻或历史输入仍可能不同；后台抽样与页面未运行时的缺口不能凭空补回。

保持名称、显示开关、背景、公告和价格配置兼容，配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发与许可

`custom` 分支，Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物 `dist/`，Actions 发布到 `build`，不会修改用户当前主题。本版代码 / 类型 / 构建、静态依赖和诊断不修改缓存、不导出凭据的约束已核对。

[LICENSE](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
