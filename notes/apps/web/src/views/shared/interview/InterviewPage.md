# `views.shared.interview.InterviewPage` 历史笔记

> 摘自 `apps/web/src/views/shared/interview/InterviewPage.tsx` 的模块 docstring。

## 一句话

面试题共用页：出题 / 生成记录两段。

## 细节

旧壳两块拼成一页：`views/interview.js`（岗位列表批量出题 + 生成记录）与
`interview_prep.js`（单岗题目弹窗 → 这里的 Sheet）。共用页不带站点语义——
出题跟的是岗位与简历分析，不跟平台。

按设置页的分段范式拆分：`TABS` + 每段一个自包含组件。原「生成任务」段 2026-10-29
迁任务中心（`#/tasks`，类型「面试题」）：取消 / 重试 / 删除 / 全部停止在那边做，本页只留路标。

任务态照旧从统一 WS store（`useTasks()`）读——在跑任务占着的岗位标「任务中」、收尾对账
「已生成」徽章都靠它；首屏与 WS 断线时用 `interviewApi.tasks()` 兜底（照 TasksPage 的口径，
5s 轮询只在断线时跑）。

## 接口约定

`interviewApi.tasks()` 的 repos 类型标 `{items}`，后端实际回 `{tasks, busy_job_ids}`，读取时两个键都认。
