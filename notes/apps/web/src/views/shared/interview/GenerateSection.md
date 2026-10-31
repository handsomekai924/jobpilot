# `views.shared.interview.GenerateSection` 历史笔记

> 摘自 `apps/web/src/views/shared/interview/GenerateSection.tsx` 的模块 docstring / 行内注释。

## 一句话

出题段：按抓取批次 / 职位名挑一批岗位批量生成。

## 细节

题量不给手填（2026-10-29）：按匹配度自动 10–15，请求不带 `question_count`；
出题按钮并进筛选条容器，不再单独占一块。在跑任务占用的岗位标「任务中」并跳过；
行内也能单个生成 / 查看题目（开 PrepSheet）。

「查看」按钮：没生成过题就禁用，避免打开空侧栏（缺陷清单「查看按钮」）。

批次下拉走共用口 `/api/crawl/tasks`（跨站点全量，批次只是职位来源）；拿不到时只剩
「全部抓取记录」，不挡出题。
