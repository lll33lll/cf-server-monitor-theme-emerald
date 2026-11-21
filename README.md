# Emerald 三网定制主题

基于 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald) 的 CF Server Monitor 自用三网主题。当前版本 **v1.2.18**。

只修改主题，不修改后端、探针或服务器，不自动切换线上设置。每根柱子只按平均值显示单一颜色，不加峰值红点、色帽或混色。

## 安装 / 升级

后台 → 主题商店 → 自定义主题 URL：

```text
https://github.com/lll33lll/cf-server-monitor-theme-emerald/tree/215f188f1c447ef217007cd3e919e5f4b37efb06
```

也可刷新后台，在 **Emerald · 自用三网版** 加载并选择新版。源码在 `custom`，产物在 `build`。旧固定 SHA 不会自动更新。

## v1.2.18：统一参考历史基准

根据浏览器实际诊断，上一版虽然核心算法与 LuminaPlus 一致，但仍把自己的额外历史样本填进原版缓存的缺口。这样改变了输入集合，丢包率自然可能不同；同输入的公式校验不能证明两个实际页面用了同样的历史。

本版修正统计来源：

- 原版已有有效缓存时，用该份历史作为基准，**保留它的缺口处理方式**，不把自有旧历史重新拼进基准。
- 自有样本只有晚于原版最后一条时才作为新尾部追加，保持继续采集新数据的能力。
- 原版缓存不存在或没有有效值时，使用自己的采样与后端窗口，仍可独立运行。
- 自己的原始、统计样本仍保留作明细和兜底，**不删除真实记录、不改写原版缓存**。
- 查询得到的自有旧历史如果不改变实际选中的统计输入，不再单独刷新统计权重时点，避免无关查询使数字漂移。
- 诊断文件会说明基准来源、参考截止时间、自有历史排除数量和新增尾部数量。

没有修改百分比系数，没有把数值写死，也没有修改采样核心或颜色分界。真实新增数据、不同窗口快照、不同统计时刻仍可能使不同页面的值不同；不能声称读取原版持久化缓存等于直接读取其标签页实时内存。

实际文件复核确认：修正后的同窗口输入、20 根丢包柱和最终统计与该文件中的参考缓存复算一致，双方存储保持不变。用户诊断数据未写入主题或公开仓库。

## 保留的核心与交互

核心参考 [LuminaPlus v1.2.24（391dc27）](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus/tree/391dc27f4ba21067afdfc3b20a4f03cde60919a6)：完整快照、变化 5 秒 / 稳定 120 秒、192 个统计样本、15 秒时长权重、20 格桶中点投影及按桶权重计算丢包率。

延迟 / 丢包两块三网竖排面板，列表独立两列，默认 2 小时。点柱子就地显示时间与平均值，滑动切换，抬手留 2.5 秒，气泡 / 高亮同步复位；不弹曲线卡片。

保持原始增量保存、字段独立合并、历史请求复用、完整多线路历史、缓存、视口定位与键盘 / 指针清理。首页不新增逐节点历史轮询。

## 只读诊断

顶部下载图标 **“导出丢包诊断”** 保存版本、画面值、时间参数和实际输入。文件只含白名单探测数据，不包含密码、JWT / Cookie、API Secret、节点 IP 或价格，不修改缓存。

“仅原版缓存复算”不是另一标签页实时显示值。先不要清缓存，不要公开提交诊断文件。

## 限制与兼容

窗口滚动、过期样本自然退出，不人为锁色；未采集历史不凭空补回。不同浏览器 / 域名独立，隐私模式 / 存储配额可能影响保存。丢包数字一位小数，内部比例不归零。

名称、显示开关、背景、公告及价格配置保持兼容，配置 JSON 见 [上游说明](https://github.com/Tokinx/cf-server-monitor-theme-emerald/blob/main/README.md)。

## 开发与许可

Node 24 + Bun 1.3.14：

```bash
bun install --frozen-lockfile
bun run lint
bun run build
```

Actions 发布到 `build`，不自动应用到用户 CFSM。代码 / 类型 / 构建、公开静态资源与实际诊断回放已核对。

[LICENSE](./LICENSE)。感谢 [Tokinx/Emerald](https://github.com/Tokinx/cf-server-monitor-theme-emerald)、[CFSM-Theme-LuminaPlus](https://github.com/volcano-1025/CFSM-Theme-LuminaPlus) 与 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)。
