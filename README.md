# Emerald 三网定制主题

基于 [Tokinx/cf-server-monitor-theme-emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 改造，保留 Emerald 原版外观，分别显示电信、联通、移动的延迟和丢包。当前定制版本 **v1.2.11**，只修改主题，不修改 CFSM 后端、探针或服务器。

## 使用

CFSM **后台 → 主题设置 → 自定义主题 URL**，填入固定版本地址并保存：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/3afdb22fa00d62e6fe6809f6a3d8e0fcde4a1c05
```

滚动构建地址：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/build
```

源码在 `custom`，可安装产物在 `build`；不要填写源码分支。最新固定版本地址同时记录在 [main README](https://github.com/lll33lll/cf-server-monitor-theme-emerald/blob/main/README.md)。后端通常缓存分支约 1 小时、固定 SHA 约 24 小时，升级时建议换新 SHA。

## 三网显示

- 卡片为延迟、丢包两块面板，面板内分别竖排电信、联通、移动；列表为独立的三网延迟和三网丢包列，手机可横向滚动。
- 每条线路 20 根柱子；时间窗口优先读取 `/api/config.latency_window.hours`，缺省为 2 小时。
- 数字从同一组柱子的有效覆盖时间加权计算，不混算运营商，不简单平均 20 个百分比。
- 直接保留 `/api/servers` 分线路 `ping[]` / `loss[]` 和实际时间戳，首页不新增历史查询。
- 真实实时样本缓存于当前浏览器 localStorage，保留窗口外 15 分钟用于衔接；旧推送过滤，无探测字段的资源更新不重复采样。
- 无数据为 `—` / 灰柱；100% 丢包为红柱、延迟 `—`；不足 0.1% 的非零丢包显示 `<0.1%`。
- 点击面板或列表对应列打开原版历史曲线；其他卡片区域仍进入详情页。
- 支持后台自定义线路名称；关闭 `show_three_net_details` 时仅显示实时三网数字，不显示历史柱。
- 丢包为连续热力色：0% 绿、3% 黄、10% 橙、30% 及以上红。延迟沿用 Emerald 分档配色。

后端必须已有三网探测数据，主题无法生成未上报的数据。浏览器关闭后不会继续采集；不同浏览器、不同主题的本地历史缓存互相独立。刚切换时不保证与其他主题的旧缓存逐根一致。统计基于可用样本覆盖，不代表额外采集了完整逐包历史。

## 开发

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

产物在 `dist/`。Actions **Publish Three-Net Theme** 将 `custom` 源码构建至 `build`，不会修改你的 CFSM 线上设置。

背景、公告、价格可见性和其他原版参数保持兼容；配置 JSON 与完整说明见 [上游 README](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

本次发布已通过代码检查、类型检查和生产构建，并核对静态资源引用无缺失；尚未替换用户的线上主题。

## 许可与致谢

[MIT](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
