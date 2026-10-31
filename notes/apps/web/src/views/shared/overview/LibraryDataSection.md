# `views.shared.overview.LibraryDataSection` 图表规范笔记

> 摘自 `apps/web/src/views/shared/overview/LibraryDataSection.tsx` 的模块 docstring。

## 一句话

总览「职位库」数据区（缺陷清单「提议：可以放置一些可视化图表」）。

## 细节

图表遵守 dataviz 规范：单值放 stat tile（不画单柱图）；采集保留率是单一比例 →
同色系 meter（不是两片饼图）；城市分布是名义类目，所有条同用 slot-1 蓝
（不按数值渐变）；采集流水只标极值，其余靠 tooltip 与表格孪生。单系列不出
图例（标题就是系列名）。颜色只用主题的 `--accent`/文本 token，明暗两套都是
validate_palette 过检的单色系（蓝 #0071E3 / #0A84FF）。

任务起停（不管进度）就重取一轮——抓完一轮数字不能一直旧着。
