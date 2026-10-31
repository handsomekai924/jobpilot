# `boss_web.api.interview` 协议笔记

> 摘自 `boss_web/api/interview.py` 的模块文档字符串。

## 一句话

面试题相关 API。

## 细节

按文档 `docs/interview-question-generation.md` 实现：

- POST   /api/interview/generate              生成面试题（整份分析 / 指定岗位 / 批量岗位）
- GET    /api/interview/tasks                 所有生成任务（数量 + 进度，页面顶部用）
- GET    /api/interview/task/current          当前任务状态
- GET    /api/interview/task/{task_id}         查询生成任务状态
- POST   /api/interview/task/{task_id}/cancel  取消生成任务
- GET    /api/interview/jobs                  出题页岗位列表（抓取记录筛选 + 职位名模糊匹配）
- GET    /api/interview/records               生成记录列表（一岗一套题）
- GET    /api/interview/context               按岗位找分析与出题状态（jobs 卡片入口用）
- GET    /api/interview/summary               一批岗位的出题状态（卡片徽章用）
- GET    /api/interview/list                  获取面试题列表（支持筛选 / 搜索 / 排序）
- PATCH  /api/interview/{question_id}         手动编辑题目
- GET    /api/interview/export                导出面试题（Markdown / JSON）
