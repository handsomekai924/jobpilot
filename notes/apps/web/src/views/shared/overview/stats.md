# `views.shared.overview.stats` 协议笔记

> 摘自 `apps/web/src/views/shared/overview/stats.ts` 的模块 docstring / 行内注释。

## 一句话

把各站点 `GET /api/sites/{site}/jobs/stats` 的返回归一并合并。

## 细节

后端形状（`boss_jobs/store.py summary()` + `boss_web/api/jobs.py stats()`）：

```
jobs / pages / raw_seen / kept_seen / dropped_seen / missing_desc
top_cities: [{city, count}]（GROUP BY city_name LIMIT 10）
pages_log: [{page, raw_count, kept_count, dropped_count, inserted_count,
             updated_count, fetched_at}]（api 还补了 inserted/updated 别名）
```

两个坑：`fetched_at` 是 "YYYY-MM-DD HH:MM:SS" 字符串（store._now()），不是秒级
时间戳；`missing_desc` 是全库计数、不分站点，合并取 max 免得按站点数翻倍。

多站点合并：计数求和；城市按名字求和取前 N（各站点的 top_cities 是各自
LIMIT 10，合并是近似，总览用途够）；页流水按时间倒序取最近 N 条再翻回时间正序。
fetched_at 是定宽字符串，localeCompare 就是时间序。
