# `apps/web/src/views/platform/jobs/JobsPage` 笔记

> 摘自 `apps/web/src/views/platform/jobs/JobsPage.tsx` 的模块说明与实现注释。

## 一句话

平台作用域的找工作页：采集入口 + 库内检索 + 卡片流 + 详情。

## 细节

### 作用域与配置

- 路由是 `#/:site/jobs`；采集条件是站点作用域配置（`/api/sites/{site}/collection/config`），就地编辑（`CollectionSheet`），不在共用设置页里配——搜索维度每个平台都不一样。
- `caps.catalog.unsupported` 维度置灰；平台差异只走描述符，视图里不写 `site ===`。
- 采集/补 JD 的细进度统一在任务中心看（本页只跟到结束好收结果），与 legacy 同款分工。

### 字段换名

后端职位主键叫 `encrypt_job_id`，公用组件的 DTO 叫 `job_id`；在本页的 `toSummary` / `toDetail` 换名，组件库保持跨平台中立。面试题摘要走共用 Repository（跨站点）。

### 交互与状态

- 首屏必拉一页（`loading` 初值 true），别让空态在拉取前闪一下；翻页/重筛时旧列表压暗占位。
- 站点一换，表单与列表全清，免得把上个平台的筛选带给下一个。
- 进页对账一次在跑的采集 / 补 JD（可能是在别的页发起的），`OPEN_STATUS` = running / pending / waiting_human，`DONE_STATUS` = done / error / cancelled。
- 开始采集 / 停止采集各有在飞旗标只管按钮防连点；「任务在跑」由 `crawlActive` 表达。
- 破坏性操作（删除、按条件清空）先弹 `ConfirmSheet` 二次确认，弹窗里跑完再收，期间按钮禁用转文案防连点。
