# `views.shared.resumes.ReviseSection` 目标范围与模式笔记

> 摘自 `apps/web/src/views/shared/resumes/ReviseSection.tsx` 的模块 docstring / 行内注释。

## 一句话

简历优化：定向（岗位 / 批次 / 全库）与自由（章节 + 提示词）两种改稿向导。

## 细节

目标范围（缺陷清单「目标范围」）：只留「爬取批次下拉 + 搜索框」同一行——
不选批次 = 搜全部职位；勾具体岗位 = 只改这几个，不勾 = 范围内全部。
不再有「全部职位 / 爬取批次」互斥分段。候选岗位列表走分页（上一页/下一页），
不用「加载更多」追加（追加列表翻页状态难对齐，页码才是可回退的导航）。

优化任务轮询在页面壳（跨段共享，去「优化记录」看详情回来任务还在跑）；
这层只管表单、启动 / 停止，以及任务完成后的「查看修改稿」跳转。

## 启动参数收口

- 自由模式 → `startFreeRevise`：带 `selected_sections` 与 `optimization_prompt`。
- 定向模式 → `startRevise`：勾了岗位 → `job_ids`；选了批次没勾 → `crawl_task_id`；
  没批次没勾 → `all_repo: true`（后端取前 `MAX_TARGET` 个）。

## 实现备注

- 批次下拉走共用批次账（`GET /api/crawl/tasks`，跨站点全量，不带 `{site}`）。
- 候选岗位：查词 / 翻页 / 批次变化都重拉（本地接口，不需要防抖）；每页整页替换。
- 换简历清掉旧选择；批次一换就回到第一页。
