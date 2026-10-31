# `tests.test_m4_guards` 架构守卫笔记

> 摘自 `tests/test_m4_guards.py` 的模块 docstring / docstring / `#` 注释。

## 一句话

把多站点收口的三条主张（依赖无环、模板方法洞数固定、任务运行时只有一份）变成会红的测试。

## 细节

多站点收口的架构守卫（todo3 第八节成功标准 #3 / #4 / #7）。

这三条是**主张**，不是文档里的一句话——不钉死的话，接第二个站点时一定会被一点点
啃掉：多调一个站点方法（洞从 3 变 4）、新任务自造一个事件环、`core` 反过来 import
业务层。这里把它们变成会红的测试：

- #3 依赖无环：`core` 只 import 自己和标准库，内部还得无环；
- #4 模板方法洞数固定：`run_crawl` / `run_deliver` 的站点调用点**各恰好 3 个**，
  且只许在模板里出现；
- #7 任务运行时只有一份：`events` 事件环不许再增生，新增长任务复用 `task_runtime`。

#2（共享层不认站点协议）见 `test_core_boundaries.py`；#5（投递门槛是共享规则）
见 `test_core_flow.py` 的两条门槛用例；#1 / #8 是流程与工期主张，静态测不了，
得等第二站点立项后拿 `git diff` 验。

### `TEMPLATE_HOLES`

每个模板方法的站点调用点，路径是「`adapter.` 之后的完整点串」。
多一个少一个都是契约破坏——多一个 = 共享层开始夹带站点编排，少一个 = 洞没填。

- `catalog.to_search_params`：通用条件 → 站点私有参数串
- `jobs.iter_pages`：翻页迭代（翻页策略是站点语义）
- `jobs.fetch_detail`：抓详情（形状站点私有）
- `messenger.open_session`：建会话（不发正文）
- `messenger.send_text`：发正文
- `applier.apply`：投简历

### `SHARED_INPUTS`

共享规则的**输入**，不是洞：站点只是如实自述能力 / 回报会话阶段 / 归类故障，
不许借它们夹带编排步骤。`run_deliver` 允许调这三个，且只许调这三个。

### `EVENT_DEQUE_OWNERS`

现存的 `events` 事件环持有者。**这个集合是历史债，不是范本**——
新增长任务不许再往里加名字，事件环该从 `task_runtime` 拿。

### `ALIAS_PREFIXES`

平台作用域资源的前缀。裸的 `/api/<前缀>/…` 是 legacy 专用兼容别名，
由 `api/__init__.py` 双挂载；**后端自报的 URL**（滑块帮助页的 `post_url`
/ `page_url`、二维码图）只许是 `/api/sites/{site}/…`，别名一摘就断在半路。

### `test_后端不往回发legacy裸路径`

这条是**踩过才加的**：`login_task` 把 `/api/auth/slider/…` 写进滑块帮助页的
`post_url`，前端开窗那条却是 `/api/sites/boss/auth/slider/…`——两个口径，
别名一摘帮助页就再也提交不了票据。加了这条之后再有人图省事写裸路径会当场红。
