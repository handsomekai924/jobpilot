# `views.shared.settings.SettingsPage` 迁移与作用域笔记

> 摘自 `apps/web/src/views/shared/settings/SettingsPage.tsx` 的模块 docstring / 行内注释。

## 一句话

设置共用页：LLM 配置 / 程序更新 / 黑名单规则 / 外观。

## 细节

迁自旧壳 `settings.js` + `settings_update.js` + `llm.js`（docs/multiplatform-console-redesign.md M2）。
共用页面不带平台作用域，但黑名单接口是平台作用域的——站点一律取
`usePlatform().activeSiteId` 去调 `blacklistApi.*`，页面里不许写
`if (site === "boss")` 这类站点判断。

采集配置不在这页：它是站点作用域（`/api/sites/{site}/collection/config`），
按 docs 3.2 归 `#/:siteId/jobs` 的「采集条件」入口（接口在
`api/platform.ts` 的 `filtersApi`），设置页只留共用四段。

## 实现备注

- LLM 配置只有 api_key / base_url / model 三项能改，采样参数是后端固定值，UI 只展示。
- 程序更新是外部进程干活，进度只在 update.log 的诊断里看得见——跑着就 2s 问一次。
- 黑名单重检去任务中心管进度 / 停止，这里只跟到收口好刷规则。
- 改完 Key 自动测一次连通，省得存了个坏 Key 不自知。
