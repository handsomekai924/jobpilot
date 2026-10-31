# `views.shared.resumes.ResumesPage` 历史与接口出入笔记

> 摘自 `apps/web/src/views/shared/resumes/ResumesPage.tsx` 的模块 docstring / 行内注释。

## 一句话

简历共用页：简历库 / 简历解析 / 简历优化 / 优化记录四段。

## 细节

旧壳 `resume.js`（简历库 + 解析）与 `resume_revise.js`（优化向导 + 修改记录）收拢到这一页；
按设置页的分段范式拆分：`TABS` + 每段一个自包含组件。原先挤在清单下方的解析详情
独立成「简历解析」段，首屏不再被详情顶掉半屏。

共用页不带站点语义。接口全部走 `api/shared.ts`（`resumeApi` / `interviewApi.jobs` /
`crawlBatchApi` / `tasksApi`），视图不拼 URL；解析任务轮询 `tasksApi.get`（解析在统一
任务中心里），优化任务轮询 `resumeApi.reviseTask`，事件流水一律过 `toTaskEvents()` 再喂
`TaskPanel`。

跨段状态放页面壳（切段不丢）：简历列表 / 选中项 / 解析任务进度 / 优化任务快照 /
原文侧栏 / 从优化任务跳过来待开的修改稿。各段组件切走即卸载（与设置页同口径）。

## API 形状出入（按后端实际形状消费，本地镜像在 `resumes/types.ts`）

1. `resumeApi.get` 声明 `{resume, content_md, llm}`，后端 `GET /api/resume/item/{id}` 实际
   是平铺的简历字典（原文在 `raw`，解析挂 `llm`）——本页按后端实际形状消费（`ResumeDetail`）。
2. `resumeApi.sections` 声明 `{sections: string[]}`，后端实际是 `{sections: [{title, level}]}`。
3. `resumeApi.revisePresets` 声明 `Record<string, string[]>`，后端每个预设是 `{name, prompt}`。
4. 缺岗位列表封装：定向模式勾岗位暂用 `interviewApi.jobs`（共用接口 `/api/interview/jobs`），
   建议补一个 `jobsApi`。

## 相对旧页的取舍（真缺就明说）

拖拽上传、原文按标题切块 + 章节滚动联动目录、岗位详情抽屉（`/api/jobs/{id}` 平台作用域，
repos 未覆盖）、LLM 模型变更提醒不迁；上传后仍自动发起解析，与旧页一致。

## 实现备注

- 解析与优化任务每 1.5s 轮询一拍；默认选中最新一条简历（后端列表已按创建时间倒序）。
- 在跑的优化任务挂载时接回（重新生成从记录页发起时也能看到进度）。
