# notes 索引

代码里的文档字符串只留**作用、入参、返回值**。协议逆向、实测记录、历史背景留在这里。

风格规范见 [docstring-style.md](docstring-style.md)（已迁到 `.claude/skills/doc-style/`，含 JS / Vue3）。

| 文件 | 源模块 | 一句话 |
|------|--------|--------|
| [_tests/test_cli.md](_tests/test_cli.md) | `tests.test_cli` | 滑块失败要报风控话术，不能把票据说成走 `--verify-token` |
| [_tests/test_core_boundaries.md](_tests/test_core_boundaries.md) | `tests.test_core_boundaries` | 守住共享内核与站点适配器之间的边界 |
| [_tests/test_expect_filter.md](_tests/test_expect_filter.md) | `tests.test_expect_filter` | 四种期望 kind 的主参数形状对齐站点 `getFormData()` |
| [_tests/test_m4_guards.md](_tests/test_m4_guards.md) | `tests.test_m4_guards` | 多站点收口的三条主张（依赖无环、模板洞数固定、运行时只有一份）变成会红的测试 |
| [_tests/test_packaging_scripts.md](_tests/test_packaging_scripts.md) | `tests.test_packaging_scripts` | 打包脚本的回归护栏，钉死上次踩过的坑 |
| [_tests/test_web_deliver.md](_tests/test_web_deliver.md) | `tests.test_web_deliver` | 「开聊提醒」是提示弹窗，不是停批信号 |
| [_tests/test_web_frontend_contract.md](_tests/test_web_frontend_contract.md) | `tests.test_web_frontend_contract` | 静态读取旧 SPA 的 JS/HTML 源文本，把文档要求的界面契约钉死 |
| [_tests/test_web_session_check.md](_tests/test_web_session_check.md) | `tests.test_web_session_check` | 启动登录态自检：验真伪、失效清库、断网不动库 |
| [apps/web/src/components/controls/Cascader.md](apps/web/src/components/controls/Cascader.md) | `apps/web/src/components/controls/Cascader.tsx` | 城市/行业级联选择：列式下钻，单选叶子取值、多选父级导航叶子勾选 |
| [apps/web/src/components/controls/MultiSelect.md](apps/web/src/components/controls/MultiSelect.md) | `apps/web/src/components/controls/MultiSelect.tsx` | 多选下拉：popover 材质弹层 + 勾选列表 + 清空 |
| [apps/web/src/components/controls/NumberField.md](apps/web/src/components/controls/NumberField.md) | `apps/web/src/components/controls/NumberField.tsx` | 数值输入：编辑中保留原始文本，失焦 / Enter 时解析、取整并夹到边界 |
| [apps/web/src/components/controls/Select.md](apps/web/src/components/controls/Select.md) | `apps/web/src/components/controls/Select.tsx` | 单选下拉：复用 TextField 骨架，菜单材质走 MuiMenu 主题 |
| [apps/web/src/components/data/BarChart.md](apps/web/src/components/data/BarChart.md) | `apps/web/src/components/data/BarChart.tsx` | 横向条形图（名义类目排名），条末直接标注 + 表格孪生取数 |
| [apps/web/src/components/data/ColumnChart.md](apps/web/src/components/data/ColumnChart.md) | `apps/web/src/components/data/ColumnChart.tsx` | 柱状图（离散序列量级比较），选择性柱帽标注 + 表格孪生取数 |
| [apps/web/src/components/data/DataTable.md](apps/web/src/components/data/DataTable.md) | `apps/web/src/components/data/DataTable.tsx` | 三张业务表统一的数据表：inset-grouped 行、悬停弱高亮、分离线不用硬边框 |
| [apps/web/src/components/data/EChart.md](apps/web/src/components/data/EChart.md) | `apps/web/src/components/data/EChart.tsx` | ECharts 生命周期壳 + 主题取色 hook；canvas 内容靠 aria-label 与表格孪生兜底 |
| [apps/web/src/components/layout/ScrollArea.md](apps/web/src/components/layout/ScrollArea.md) | `apps/web/src/components/layout/ScrollArea.tsx` | 「整页固定 + 内部滚动」布局契约：滚动只发生在 `ScrollArea` |
| [apps/web/src/views/platform/deliver/DeliverPage.md](apps/web/src/views/platform/deliver/DeliverPage.md) | `apps/web/src/views/platform/deliver/DeliverPage.tsx` | 平台作用域的发对话与投递页：门槛两路径 + 配额 + 发送清单 |
| [apps/web/src/views/platform/jobs/CollectionSheet.md](apps/web/src/views/platform/jobs/CollectionSheet.md) | `apps/web/src/views/platform/jobs/CollectionSheet.tsx` | 采集条件表单：搜索条件 + 采集参数 + 期望流来源一次改完，保存压平 |
| [apps/web/src/views/platform/jobs/JobsPage.md](apps/web/src/views/platform/jobs/JobsPage.md) | `apps/web/src/views/platform/jobs/JobsPage.tsx` | 平台作用域的找工作页：采集入口 + 库内检索 + 卡片流 + 详情 |
| [apps/web/src/views/platform/jobs/collection.md](apps/web/src/views/platform/jobs/collection.md) | `apps/web/src/views/platform/jobs/collection.ts` | 采集配置的纯函数面：摘要文案、PUT 载荷拼装、期望流键解析 |
| [apps/web/src/views/platform/login/LoginPage.md](apps/web/src/views/platform/login/LoginPage.md) | `apps/web/src/views/platform/login/LoginPage.tsx` | 平台作用域登录页：发码 / 扫码两个主动入口 + 三种人机喂料表单 |
| [apps/web/src/views/shared/interview/GenerateSection.md](apps/web/src/views/shared/interview/GenerateSection.md) | `apps/web/src/views/shared/interview/GenerateSection.tsx` | 出题段：按抓取批次 / 职位名挑一批岗位批量生成 |
| [apps/web/src/views/shared/interview/InterviewPage.md](apps/web/src/views/shared/interview/InterviewPage.md) | `apps/web/src/views/shared/interview/InterviewPage.tsx` | 面试题共用页：出题 / 生成记录两段 |
| [apps/web/src/views/shared/match/MatchCard.md](apps/web/src/views/shared/match/MatchCard.md) | `apps/web/src/views/shared/match/MatchCard.tsx` | 一条匹配结果卡：分数圆环 + 职位/公司 + 匹配理由 + 招呼语 |
| [apps/web/src/views/shared/match/MatchPage.md](apps/web/src/views/shared/match/MatchPage.md) | `apps/web/src/views/shared/match/MatchPage.tsx` | 人岗匹配共用页：匹配工作台 / 分析历史 / 招呼语三段 |
| [apps/web/src/views/shared/match/WorkbenchSection.md](apps/web/src/views/shared/match/WorkbenchSection.md) | `apps/web/src/views/shared/match/WorkbenchSection.tsx` | 匹配工作台：发起匹配（搜索范围 + 可选勾选）+ 任务进度 + 匹配结果 |
| [apps/web/src/views/shared/overview/LibraryDataSection.md](apps/web/src/views/shared/overview/LibraryDataSection.md) | `apps/web/src/views/shared/overview/LibraryDataSection.tsx` | 总览「职位库」数据区与可视化图表规范 |
| [apps/web/src/views/shared/overview/stats.md](apps/web/src/views/shared/overview/stats.md) | `apps/web/src/views/shared/overview/stats.ts` | 把各站点 `GET /api/sites/{site}/jobs/stats` 的返回归一并合并 |
| [apps/web/src/views/shared/resumes/ResumesPage.md](apps/web/src/views/shared/resumes/ResumesPage.md) | `apps/web/src/views/shared/resumes/ResumesPage.tsx` | 简历共用页：简历库 / 简历解析 / 简历优化 / 优化记录四段 |
| [apps/web/src/views/shared/resumes/ReviseSection.md](apps/web/src/views/shared/resumes/ReviseSection.md) | `apps/web/src/views/shared/resumes/ReviseSection.tsx` | 简历优化：定向（岗位 / 批次 / 全库）与自由（章节 + 提示词）两种改稿向导 |
| [apps/web/src/views/shared/settings/SettingsPage.md](apps/web/src/views/shared/settings/SettingsPage.md) | `apps/web/src/views/shared/settings/SettingsPage.tsx` | 设置共用页：LLM 配置 / 程序更新 / 黑名单规则 / 外观 |
| [boss_db/__init__.md](boss_db/__init__.md) | `boss_db.__init__` | 三类表的分工与线程本地连接模型（为什么 `doc` 存整包 JSON） |
| [boss_filter/client.md](boss_filter/client.md) | `boss_filter.client` | 筛选条件线上接口客户端，登录态复用落盘 Cookie |
| [boss_filter/expect.md](boss_filter/expect.md) | `boss_filter.expect` | 期望流四个 tab 共用 `recommend/job/list.json` 的参数装配 |
| [boss_filter/search.md](boss_filter/search.md) | `boss_filter.search` | 搜索维度拼成 `joblist.json` 认的查询串参数 |
| [boss_filter/tables.md](boss_filter/tables.md) | `boss_filter.tables` | 筛选项兜底常量表，文案与 code 与线上接口逐项对齐 |
| [boss_jobs/cdp_capture.md](boss_jobs/cdp_capture.md) | `boss_jobs.cdp_capture` | CDP 网络抓包，含 WS 全帧落盘 |
| [boss_jobs/cdp_stoken.md](boss_jobs/cdp_stoken.md) | `boss_jobs.cdp_stoken` | `__zp_stoken__` 的真浏览器获取与过期判断 |
| [boss_jobs/chat.md](boss_jobs/chat.md) | `boss_jobs.chat` | MQTT over WebSocket + 手写 protobuf 帧的聊天协议 |
| [boss_jobs/cli.md](boss_jobs/cli.md) | `boss_jobs.cli` | CLI 帮助里被精简掉的检索流说明与 stoken 补令牌流程 |
| [boss_jobs/client.md](boss_jobs/client.md) | `boss_jobs.client` | 职位列表客户端：真实 wapi 路径 + 每页即时清洗入库 |
| [boss_jobs/config.md](boss_jobs/config.md) | `boss_jobs.config` | 接口路由、业务码、网关令牌常量的实测结论 |
| [boss_jobs/errors.md](boss_jobs/errors.md) | `boss_jobs.errors` | 「开聊提醒」配额弹窗的包体形状与码位语义 |
| [boss_jobs/models.md](boss_jobs/models.md) | `boss_jobs.models` | 职位 DTO 与即时清洗规则，含字段名不对称记录 |
| [boss_jobs/stoken.md](boss_jobs/stoken.md) | `boss_jobs.stoken` | `__zp_stoken__` 的来源、算法与全自动获取链路 |
| [boss_login/client.md](boss_login/client.md) | `boss_login.client` | 短信登录客户端完整流程 |
| [boss_login/config.md](boss_login/config.md) | `boss_login.config` | 接口地址、请求头、业务码常量的线上核实状态 |
| [boss_login/crypto.md](boss_login/crypto.md) | `boss_login.crypto` | AES 加密，复刻登录页 `re(plain, atob(E))` |
| [boss_login/qrcode.md](boss_login/qrcode.md) | `boss_login.qrcode` | APP 扫码登录，复刻 `BossAppScan` 流程 |
| [boss_login/verify.md](boss_login/verify.md) | `boss_login.verify` | 滑块验证协议：拉挑战、交本人解、组装票据 |
| [boss_web/api/__init__.md](boss_web/api/__init__.md) | `boss_web.api.__init__` | HTTP 路由层：平台作用域路由与共用路由的挂载 |
| [boss_web/api/crawl.md](boss_web/api/crawl.md) | `boss_web.api.crawl` | 抓取任务 API：启动 / 进度 / 取消 + 历史任务档案 |
| [boss_web/api/interview.md](boss_web/api/interview.md) | `boss_web.api.interview` | 面试题相关 API |
| [boss_web/api/settings.md](boss_web/api/settings.md) | `boss_web.api.settings` | 平台设置：每站点的节流/每日配额/并发/投递开关（`site_settings`） |
| [boss_web/cli.md](boss_web/cli.md) | `boss_web.cli` | 网页控制台命令行入口 |
| [boss_web/core/adapters/boss.md](boss_web/core/adapters/boss.md) | `boss_web.core.adapters.boss` | BOSS 直聘站点适配器：薄壳包现有 `boss_jobs` / `boss_login` / `boss_filter` |
| [boss_web/core/flow.md](boss_web/core/flow.md) | `boss_web.core.flow` | 编排骨架：`run_crawl` / `run_deliver` 两个模板方法，共享层定死流程，站点只填洞 |
| [boss_web/core/limits.md](boss_web/core/limits.md) | `boss_web.core.limits` | 站点限速/配额与投递熔断 |
| [boss_web/runtime.md](boss_web/runtime.md) | `boss_web.runtime` | 开发模式与打包 exe 两种形态的路径差异 |
| [boss_web/services/app_settings_store.md](boss_web/services/app_settings_store.md) | `boss_web.services.app_settings_store` | 用户级应用设置，状态库 `doc('app_settings')` |
| [boss_web/services/crawl_task.md](boss_web/services/crawl_task.md) | `boss_web.services.crawl_task` | 后台抓取任务：线程跑爬取，网页轮询进度 |
| [boss_web/services/deliver_task.md](boss_web/services/deliver_task.md) | `boss_web.services.deliver_task` | 一键投递：串行打招呼并发出招呼语 |
| [boss_web/services/greeting_prompt.md](boss_web/services/greeting_prompt.md) | `boss_web.services.greeting_prompt` | 招呼语生成约束：出厂默认 + 用户自定义，运行期注入模板 |
| [boss_web/services/llm_client.md](boss_web/services/llm_client.md) | `boss_web.services.llm_client` | OpenAI 兼容的 Chat Completions 客户端 |
| [boss_web/services/login_task.md](boss_web/services/login_task.md) | `boss_web.services.login_task` | 登录任务状态机，把阻塞回调接到网页表单 |
| [boss_web/services/match_task.md](boss_web/services/match_task.md) | `boss_web.services.match_task` | 匹配任务：简历 vs 岗位，并行调 LLM 出匹配度与招呼语 |
| [boss_web/services/resume_parser.md](boss_web/services/resume_parser.md) | `boss_web.services.resume_parser` | 简历 LLM 固定模板解析 |
| [boss_web/services/session_check.md](boss_web/services/session_check.md) | `boss_web.services.session_check` | 启动时拿库里凭证打一次用户信息接口验登录态 |
| [boss_web/services/task_runtime.md](boss_web/services/task_runtime.md) | `boss_web.services.task_runtime` | 统一任务运行时：任务模型、并发策略、事件总线（WS 广播） |
| [boss_web/services/troubleshoot.md](boss_web/services/troubleshoot.md) | `boss_web.services.troubleshoot` | 技术异常翻成人话 + Chrome 环境检测 |
| [boss_web/services/update_check.md](boss_web/services/update_check.md) | `boss_web.services.update_check` | 对着 Gitee 发行版比版本号 |
| [boss_web/services/updater.md](boss_web/services/updater.md) | `boss_web.services.updater` | 应用内自更新：下载 zip → 校验 → bat 换文件重启，推 WS 进度 |
| [boss_web/static/js/update.md](boss_web/static/js/update.md) | `boss_web/static/js/update.js` | 自更新前端：`showUpdateDone` 只刷新不关窗的三个坑 + 时序 |
| [boss_web/static/legacy/js/settings.md](boss_web/static/legacy/js/settings.md) | `boss_web/static/legacy/js/views/settings.js` | 「版本更新」页签圆点与忽略水位线 |
| [boss_web/static/legacy/js/task_watch.md](boss_web/static/legacy/js/task_watch.md) | `boss_web/static/legacy/js/task_watch.js` | 任务观察器：把「1.5s 轮询 status」换成「统一 WS 事件驱动」 |
| [boss_web/static/legacy/js/update.md](boss_web/static/legacy/js/update.md) | `boss_web/static/legacy/js/update.js` | 版本更新提示：首屏弹窗 + 挂机 toast + 应用内自更新进度 |
| [packaging/make_zip.md](packaging/make_zip.md) | `packaging.make_zip` | 发行 zip 过滤规则与 Windows 打包坑 |
| [tools/mock_server.md](tools/mock_server.md) | `tools.mock_server` | 本地假服务端，离线演练登录/发码/滑块/筛选接口 |
| [tools/probe_expect.md](tools/probe_expect.md) | `tools.probe_expect` | 求职期望流五个待定点的 P3 实测校准 |
