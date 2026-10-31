# `apps/web/src/views/platform/jobs/collection` 笔记

> 摘自 `apps/web/src/views/platform/jobs/collection.ts` 的模块说明与函数注释。

## 一句话

采集配置的纯函数面：摘要文案、PUT 载荷拼装、期望流键解析。

## 细节

### 两份配置的形状差异

后端 `GET /collection/config` 回 `{search, collection}` 两块，`PUT` 收压平的一份（`CollectionBody`）：

- 搜索块字段是驼峰（`jobType` / `encryptExpectId` / `pageSize` …）；
- 采集块字段是下划线（`max_pages` / `expect_kind` / `encrypt_expect_id` …）；
- `encrypt_expect_id` 是下划线名（GET 的搜索块里叫 `encryptExpectId`），后端 `data.get("encrypt_expect_id")` 搜索流与期望流共用同一份。

两块的拼装/拆解都在这里收口，视图不自己拼。

### 摘要文案

摘要文案是 legacy `jobs.js collectionSummary` 的原样移植，含「期望流 / 搜索流生效维度不同」的差异：

- 期望流模式下不列关键词、职位类型、阶段；
- 兼职流模式下不列薪资，改列薪资方式与兼职类型；
- 末尾固定附「最多 N 页」「抓取 JD / 不抓 JD」「保存并标记黑名单 / 不保存黑名单」；
- 一个维度都没有时回「不限（未设置筛选维度）」。

`lookup` 把配置里的维度 code 翻回原文本（缺陷「当前采集条件不要显示代码」）；选项表拿不到时回退成恒等映射，不挡主流程。

### 期望流

- `expectChoices` 把混合推荐 + 具名期望 + 兼职摊平成列表行，末尾可挂临时期望；
- `choiceKeyOf` 把存下的 `expect_kind` / `encrypt_expect_id` 反查成下拉键（legacy `choiceKeyOf` 语义）。
