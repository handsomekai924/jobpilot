"""匹配任务：简历 vs 全库/勾选岗位，并行调 LLM，出匹配度 + 优缺点 + 招呼语。

输出模板（pros / cons / greeting）是本模块的唯一实现（原遗留分析器
`resume_analyzer` 已随 `/api/resume/analyze*` 一并下线）；差异与 C4/C6 设计
见 `notes/jobpilot_server/services/match_task.md`。

Attributes:
    SYSTEM_PROMPT: 人岗匹配的系统提示词。
    USER_TEMPLATE: 单条职位的用户提示词模板。
    STATUS_RUNNING: 任务状态：进行中。
    STATUS_DONE: 任务状态：完成。
    STATUS_ERROR: 任务状态：失败。
    STATUS_CANCELLED: 任务状态：已取消。
    GREETING_SYSTEM_PROMPT: 只重打招呼语的短系统提示词。
    GREETING_USER_TEMPLATE: 只重打招呼语的用户提示词模板。
    RESULT_FIELDS: 重跑结果要回写的分析字段。
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import Counter, deque
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, as_completed, wait
from typing import Any, Sequence

from jobpilot_ai.matching import (
    GREETING_SYSTEM_PROMPT,
    GREETING_USER_TEMPLATE,
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    build_greeting_messages,
    clean_greeting as _clean_greeting,
    greeting_fields as _greet_fields,
    job_desc_block as _job_desc_block,
    match_one as _ai_match_one,
    resume_brief as _resume_brief,
)
from jobpilot_platform_boss.jobs.models import Job

from .. import config as C
from ..errors import ConflictError, NotFoundError, UpstreamError, ValidationWebError
from .greeting_prompt import resolve_greeting_requirement
from .llm_client import LLMClient
from .llm_config_store import load_config
from .resume_store import (
    load_analysis,
    load_llm_parse,
    load_resume,
    save_analysis,
    update_match_result,
)
from .task_runtime import POLICY_UNLIMITED, TaskTypeSpec, hub

logger = logging.getLogger(__name__)

STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_ERROR = "error"
STATUS_CANCELLED = "cancelled"

hub.register(
    TaskTypeSpec(
        "match",
        title="简历匹配",
        policy=POLICY_UNLIMITED,
        title_fn=lambda req: f"简历匹配（{req.get('resume_id') or ''}）",
    )
)

class MatchTask:
    """内存里的匹配任务状态与事件流水。

    Attributes:
        crawl_task_id: 非空 = 只跑该抓取任务的岗位（优先级高于 job_ids）。
        analysis_id: 落盘用的分析 id（与 task_id 同值）。
    """

    def __init__(
        self,
        resume_id: str,
        job_ids: Sequence[str],
        *,
        crawl_task_id: str = "",
    ) -> None:
        """初始化。"""
        self.task_id = "mt_" + uuid.uuid4().hex[:10]
        self.resume_id = resume_id
        self.job_ids = list(job_ids)
        self.crawl_task_id = str(crawl_task_id or "")
        self.status = STATUS_RUNNING
        self.created_at = time.time()
        self.ended_at: float | None = None
        self.error: str | None = None
        self.done = 0
        self.total = 0
        self.current_job = ""
        self.matches: list[dict[str, Any]] = []
        self.events: deque[dict[str, Any]] = deque(maxlen=100)
        self.cancel_flag = False
        self.lock = threading.RLock()
        self.analysis_id = self.task_id

    def push(self, name: str, payload: dict[str, Any] | None = None) -> None:
        """记一条事件。

        Args:
            name: 事件名。
            payload: 事件载荷。
        """
        with self.lock:
            self.events.append({"at": time.time(), "name": name, "payload": payload or {}})

    def scope_info(self) -> dict[str, Any]:
        """范围条要的形状：`all` / `jobs` / `crawl_task`。

        Returns:
            范围描述 dict。
        """
        if self.crawl_task_id:
            return {
                "type": "crawl_task",
                "crawl_task_id": self.crawl_task_id,
                "job_count": self.total,
            }
        if self.job_ids:
            return {"type": "jobs", "job_count": self.total, "requested": len(self.job_ids)}
        return {"type": "all", "job_count": self.total}

    def snapshot(self) -> dict[str, Any]:
        """当前状态副本。

        Returns:
            含进度、matches 与最近事件的 dict。
        """
        with self.lock:
            return {
                "task_id": self.task_id,
                "analysis_id": self.analysis_id,
                "status": self.status,
                "resume_id": self.resume_id,
                "crawl_task_id": self.crawl_task_id,
                "scope": self.scope_info(),
                "created_at": self.created_at,
                "ended_at": self.ended_at,
                "error": self.error,
                "done": self.done,
                "total": self.total,
                "current_job": self.current_job,
                "matches": list(self.matches),
                "events": list(self.events)[-20:],
            }


class MatchTaskManager:
    """多任务并发匹配：可同时跑多个匹配任务，按 id 查进度。

    Attributes:
        KEEP: 最多保留的历史任务数（含在跑的）。
        _lock: 任务表锁。
        _tasks: 任务表（保留最近若干条）。
    """

    KEEP = 50

    def __init__(self) -> None:
        """初始化。"""
        self._lock = threading.Lock()
        self._tasks: dict[str, MatchTask] = {}

    def current(self) -> MatchTask | None:
        """最近一个任务；没有则 `None`。

        Returns:
            最近任务或 `None`。
        """
        with self._lock:
            if not self._tasks:
                return None
            return next(reversed(self._tasks.values()))

    def running(self) -> list[MatchTask]:
        """所有在跑的匹配任务。"""
        with self._lock:
            return [t for t in self._tasks.values() if t.status == STATUS_RUNNING]

    def all(self) -> list[MatchTask]:
        """最近保留的全部任务，按启动时间从新到旧。"""
        with self._lock:
            return list(reversed(self._tasks.values()))

    def get(self, task_id: str) -> MatchTask:
        """按 id 取任务；不存在抛 `NotFoundError`。"""
        with self._lock:
            task = self._tasks.get(task_id)
        if task is None:
            raise NotFoundError(f"匹配任务不存在：{task_id}")
        return task

    def snapshot(self, task_id: str | None = None) -> dict[str, Any]:
        """查询进度快照；指定 task_id 不存在抛 `NotFoundError`。

        Args:
            task_id: 可选，指定任务；省略回最近一个。

        Returns:
            任务快照；空闲时为 idle。
        """
        if task_id:
            return self.get(task_id).snapshot()
        task = self.current()
        if task is None:
            return {"task_id": None, "status": "idle"}
        return task.snapshot()

    def list_snapshots(self) -> dict[str, Any]:
        """全部匹配任务快照（任务中心 / 匹配页面板用）。"""
        tasks = self.all()
        return {
            "running_count": sum(1 for t in tasks if t.status == STATUS_RUNNING),
            "tasks": [t.snapshot() for t in tasks],
        }

    def start(
        self,
        *,
        resume_id: str,
        job_ids: Sequence[str] | None = None,
        crawl_task_id: str = "",
    ) -> MatchTask:
        """启动一次匹配并起后台线程（可与其它匹配任务并行）。

        Args:
            resume_id: 简历 id。
            job_ids: 指定职位；空则看 crawl_task_id 或全库。
            crawl_task_id: 抓取任务 id；非空则只跑该批岗位。

        Returns:
            新建的匹配任务（启动失败也返回可查询状态）。
        """
        request = {
            "resume_id": resume_id,
            "job_ids": list(job_ids or []),
            "crawl_task_id": crawl_task_id,
        }
        hub.occupy("match", request=request)
        task = MatchTask(resume_id, job_ids or [], crawl_task_id=crawl_task_id)
        with self._lock:
            self._tasks[task.task_id] = task
            self._prune_locked()
        hub.track(
            task,
            task_type="match",
            request=request,
            retry_fn=lambda: self.start(**request),
        )

        try:
            jobs = _pick_jobs(task)
        except Exception as exc:  # noqa: BLE001 - 启动失败也要返回可查询的任务状态
            with task.lock:
                task.status = STATUS_ERROR
                task.error = f"读取职位失败：{exc}"
                task.ended_at = time.time()
            hub.release(task.task_id)
            return task

        with task.lock:
            task.total = len(jobs)
            if not jobs:
                task.status = STATUS_ERROR
                if task.crawl_task_id:
                    task.error = "本批职位已不在库中，无法匹配"
                else:
                    task.error = "没有可匹配的职位，请先抓取或指定 job_ids"
                task.ended_at = time.time()
                hub.release(task.task_id)
                return task

        thread = threading.Thread(target=self._run, args=(task, jobs), daemon=True, name=task.task_id)
        thread.start()
        return task

    def cancel(self, task_id: str | None = None) -> MatchTask:
        """请求取消某个任务；不给 id 则取消最近一个，找不到任务抛 `NotFoundError`。

        Args:
            task_id: 可选任务 id。

        Returns:
            被取消的任务。
        """
        if task_id:
            task = self.get(task_id)
        else:
            task = self.current()
            if task is None:
                raise NotFoundError("没有在跑的匹配任务")
        task.cancel_flag = True
        hub.notify(task.task_id)
        return task

    def _prune_locked(self) -> None:
        """历史裁到 `KEEP`，只裁已结束的。"""
        if len(self._tasks) <= self.KEEP:
            return
        finished = [tid for tid, t in self._tasks.items() if t.status != STATUS_RUNNING]
        while len(self._tasks) > self.KEEP and finished:
            self._tasks.pop(finished.pop(0), None)

    def _run(self, task: MatchTask, jobs: list[Job]) -> None:
        """线程体：并行匹配并落盘。

        Args:
            task: 匹配任务。
            jobs: 本批职位。
        """
        try:
            try:
                resume = load_resume(task.resume_id)
            except FileNotFoundError:
                task.status = STATUS_ERROR
                task.error = f"简历不存在：{task.resume_id}"
                task.ended_at = time.time()
                return

            cfg = load_config()
            if not cfg.configured:
                task.status = STATUS_ERROR
                task.error = "LLM 还没配置，请先到「模型」页填好 API Key / Base URL / 模型名"
                task.ended_at = time.time()
                return

            try:
                llm_parse = load_llm_parse(task.resume_id)
            except FileNotFoundError:
                llm_parse = None
            resume_brief = _resume_brief(resume, llm_parse)

            llm = LLMClient(cfg)
            self._run_parallel(task, llm, resume_brief, jobs)
            _finalize(task, resume, cfg, llm_parse)
        except Exception as exc:  # noqa: BLE001 - 线程里兜住，状态给前端
            logger.exception("匹配任务 %s 失败", task.task_id)
            with task.lock:
                task.status = STATUS_ERROR
                task.error = str(exc) or exc.__class__.__name__
                task.ended_at = time.time()
            task.push("error", {"message": task.error})
        finally:
            hub.release(task.task_id)

    def _run_parallel(
        self,
        task: MatchTask,
        llm: LLMClient,
        resume_brief: str,
        jobs: list[Job],
    ) -> None:
        """并发跑：最多 `MATCH_CONCURRENCY` 条在途。

        Args:
            task: 匹配任务。
            llm: LLM 客户端。
            resume_brief: 简历摘要块。
            jobs: 本批职位。
        """
        workers = max(1, int(C.MATCH_CONCURRENCY))
        window = workers * 2
        pending: dict[Any, Job] = {}
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix=task.task_id) as pool:
            for job in jobs:
                if task.cancel_flag:
                    break
                with task.lock:
                    task.current_job = job.job_name
                task.push("job_start", {"job_name": job.job_name, "brand": job.brand_name})
                pending[pool.submit(self._match_job, task, llm, resume_brief, job)] = job
                if len(pending) >= window:
                    for done in wait(pending, return_when=FIRST_COMPLETED).done:
                        pending.pop(done)
                        _collect(done)
            for future in as_completed(list(pending)):
                _collect(future)

        if task.cancel_flag:
            task.status = STATUS_CANCELLED

    @staticmethod
    def _match_job(task: MatchTask, llm: LLMClient, resume_brief: str, job: Job) -> None:
        """跑一个职位并把结果落进任务；失败只记 `error`，不抛。

        Args:
            task: 匹配任务。
            llm: LLM 客户端。
            resume_brief: 简历摘要块。
            job: 职位。
        """
        if task.cancel_flag:
            return
        try:
            result = _match_one(llm, resume_brief, job)
        except Exception as exc:  # noqa: BLE001 - 单个职位失败不拖垮整批
            logger.warning("匹配职位 %s 失败：%s", job.job_name, exc)
            result = {
                "match_score": 0,
                "matched_skills": [],
                "missing_skills": [],
                "verdict": "匹配失败",
                "pros": [],
                "cons": [],
                "advice": "",
                "greeting": "",
                "error": str(exc),
            }
        item = {
            "encrypt_job_id": job.encrypt_job_id,
            "job_name": job.job_name,
            "brand_name": job.brand_name,
            "location": job.location,
            "salary_desc": job.salary_desc,
            "job_experience": job.job_experience,
            "job_degree": job.job_degree,
            "brand_industry": job.brand_industry,
            "brand_scale_name": job.brand_scale_name,
            "security_id": job.security_id,
            "lid": job.lid,
            "last_greeted_at": job.last_greeted_at or "",
            **_blacklist_snapshot(job),
            **result,
        }
        with task.lock:
            task.matches.append(item)
            task.done += 1
        task.push("job_done", {"job_name": job.job_name, "score": item.get("match_score")})


match_tasks = MatchTaskManager()


def _collect(future: Any) -> None:
    """收一个 worker 的结果；worker 内已吞掉业务异常，这里只兜底。

    Args:
        future: worker future。
    """
    try:
        future.result()
    except Exception:  # noqa: BLE001 - 兜底，别让一个 worker 拖停整批
        logger.warning("匹配 worker 异常", exc_info=True)


def _pick_jobs(task: MatchTask) -> list[Job]:
    """范围解析优先级：`crawl_task_id` > `job_ids` > 全库。

    Args:
        task: 匹配任务。

    Returns:
        职位列表。
    """
    from jobpilot_platform_boss.jobs.store import JobStore

    with JobStore() as store:
        if task.crawl_task_id:
            ids = store.crawl_task_job_ids(task.crawl_task_id, only_existing=True)
            jobs = []
            for jid in ids:
                job = store.get_job(jid)
                if job is not None:
                    jobs.append(job)
            return jobs
        if task.job_ids:
            jobs = []
            for jid in task.job_ids:
                job = store.get_job(jid)
                if job is not None:
                    jobs.append(job)
            return jobs
        return store.list_jobs(limit=100000, offset=0)


def _blacklist_snapshot(job: Job) -> dict[str, Any]:
    """把职位当前安全状态拷进 match（与 match_task 同款字段）。

    Args:
        job: 职位。

    Returns:
        安全快照字段。
    """
    return {
        "is_blacklisted": bool(job.is_blacklisted),
        "company_blacklisted": bool(job.company_blacklisted),
        "jd_blacklisted": bool(job.jd_blacklisted),
        "blacklist_types": list(job.blacklist_types),
        "matched_rule_ids": list(job.matched_rule_ids),
        "matched_rule_snapshot": [dict(rule) for rule in job.matched_rule_snapshot],
        "blacklist_checked_at": job.blacklist_checked_at,
        "jd_status": job.jd_status or "pending",
        "jd_rule_checked": bool(job.jd_rule_checked),
        "jd_rule_checked_at": job.jd_rule_checked_at,
        "auto_delivery_blocked": bool(job.auto_delivery_blocked),
    }


def _auto_delivery_blocked(item: dict[str, Any]) -> bool:
    """保守口径：命中黑名单或安全状态不完整，都不算「可自动投递」。

    与投递侧 `jobpilot_server.services.deliver_task._delivery_restriction`
    保持同一套判断，仅用于分析汇总计数。

    Args:
        item: 一条 match。

    Returns:
        是否应拦下自动投递。
    """
    return bool(
        item.get("company_blacklisted")
        or item.get("jd_blacklisted")
        or not item.get("jd_rule_checked", False)
        or item.get("auto_delivery_blocked")
        or str(item.get("jd_status") or "") in {"failed", "pending", "collecting", "unchecked"}
    )


def _match_one(llm: LLMClient, resume_brief: str, job: Job) -> dict[str, Any]:
    """单条职位跑一次 LLM 匹配；招呼语约束现读设置后再交给 `jobpilot_ai`。

    Args:
        llm: LLM 客户端。
        resume_brief: 简历摘要块。
        job: 职位。

    Returns:
        模板形状的匹配结果。
    """
    return _ai_match_one(
        llm,
        resume_brief,
        job,
        greeting_requirement=resolve_greeting_requirement(),
        max_tokens=C.LLM_MATCH_MAX_TOKENS,
    )


def regenerate_greeting(
    *,
    analysis_id: str,
    encrypt_job_id: str,
    llm: LLMClient | None = None,
) -> str:
    """重打一条招呼语草稿，只回文案、不落库；分析/职位/简历缺失、LLM 未配置或 AI 无可用输出时抛错。

    Args:
        analysis_id: 分析 id。
        encrypt_job_id: 职位 id。
        llm: 注入的客户端（测试用）。

    Returns:
        招呼语文案。
    """
    resume_id, item, _payload = _match_context(analysis_id, encrypt_job_id)

    if llm is None:
        cfg = load_config()
        if not cfg.configured:
            raise ValidationWebError(
                "LLM 还没配置，请先到「模型」页填好 API Key / Base URL / 模型名"
            )
        client: LLMClient = LLMClient(cfg)
    else:
        client = llm

    try:
        resume = load_resume(resume_id)
    except FileNotFoundError as exc:
        raise NotFoundError(f"简历不存在：{resume_id}") from exc
    try:
        llm_parse = load_llm_parse(resume_id)
    except FileNotFoundError:
        llm_parse = None

    messages = build_greeting_messages(
        resume_brief_text=_resume_brief(resume, llm_parse),
        greeting_requirement=resolve_greeting_requirement(),
        fields=_greet_fields(item, _load_job(encrypt_job_id)),
    )
    greeting = _clean_greeting(client.chat(messages))
    if not greeting:
        retry_user = messages[1]["content"] + "\n\n请严格只输出私信正文。"
        greeting = _clean_greeting(
            client.chat([messages[0], {"role": "user", "content": retry_user}])
        )
    if not greeting:
        raise UpstreamError("AI 没返回能用的招呼语，再点一次「重新生成」试试。")
    return greeting


RESULT_FIELDS: tuple[str, ...] = (
    "match_score",
    "matched_skills",
    "missing_skills",
    "verdict",
    "pros",
    "cons",
    "advice",
    "greeting",
    "error",
)


def rematch_job(
    *,
    analysis_id: str,
    encrypt_job_id: str,
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """对一条 match 重跑人岗匹配，结果原地回写（只改不增）；分析/职位/简历缺失或 LLM 未配置时抛错。

    Args:
        analysis_id: 分析 id。
        encrypt_job_id: 职位 id。
        llm: 注入的客户端（测试用）。

    Returns:
        回改后的那条 match。
    """
    resume_id, item, payload = _match_context(analysis_id, encrypt_job_id)

    if llm is None:
        cfg = load_config()
        if not cfg.configured:
            raise ValidationWebError(
                "LLM 还没配置，请先到「模型」页填好 API Key / Base URL / 模型名"
            )
        client: LLMClient = LLMClient(cfg)
    else:
        client = llm

    try:
        resume = load_resume(resume_id)
    except FileNotFoundError as exc:
        raise NotFoundError(f"简历不存在：{resume_id}") from exc
    try:
        llm_parse = load_llm_parse(resume_id)
    except FileNotFoundError:
        llm_parse = None

    job = _load_job(encrypt_job_id) or _job_from_snapshot(item)
    try:
        result = _match_one(client, _resume_brief(resume, llm_parse), job)
        result["error"] = ""
    except Exception as exc:  # noqa: BLE001 - 重跑再失败只换 error，别掀掉已有内容
        logger.warning("重新匹配职位 %s 失败：%s", item.get("job_name"), exc)
        return _write_match(
            analysis_id, encrypt_job_id, {"error": str(exc)}, in_db=payload is not None
        )

    fields = {k: result[k] for k in RESULT_FIELDS if k in result}
    return _write_match(analysis_id, encrypt_job_id, fields, in_db=payload is not None)


def _write_match(
    analysis_id: str, encrypt_job_id: str, fields: dict[str, Any], *, in_db: bool
) -> dict[str, Any]:
    """回写那条 match：已落库的 UPDATE 那一行，没落库的改在跑任务的内存列表。

    Args:
        analysis_id: 分析 id。
        encrypt_job_id: 职位 id。
        fields: 要回写的字段。
        in_db: 是否已落库。

    Returns:
        回改后的那条 match。
    """
    if in_db:
        return update_match_result(analysis_id, encrypt_job_id, **fields)
    task = match_tasks.current()
    if task is None or task.analysis_id != analysis_id:
        raise FileNotFoundError(analysis_id)
    with task.lock:
        for it in task.matches:
            if it.get("encrypt_job_id") == encrypt_job_id:
                it.update(fields)
                return dict(it)
    raise KeyError(encrypt_job_id)


def _match_context(
    analysis_id: str, encrypt_job_id: str
) -> tuple[str, dict[str, Any], dict[str, Any] | None]:
    """取 `(resume_id, 那条 match, 落库的 analysis payload)`。

    Args:
        analysis_id: 分析 id。
        encrypt_job_id: 职位 id。

    Returns:
        resume_id、那条 match、payload（`None` = 还没落库）。
    """
    try:
        payload = load_analysis(analysis_id)
    except FileNotFoundError:
        task = match_tasks.current()
        if task is None or task.analysis_id != analysis_id:
            raise FileNotFoundError(analysis_id)
        resume_id = task.resume_id
        matches = list(task.matches)
        payload = None
    else:
        resume_id = str(payload.get("resume_id") or "")
        matches = payload.get("matches") or []
    for item in matches:
        if isinstance(item, dict) and item.get("encrypt_job_id") == encrypt_job_id:
            return resume_id, item, payload
    raise KeyError(encrypt_job_id)


def _load_job(encrypt_job_id: str) -> Job | None:
    """从库里读职位；没有则 `None`。

    Args:
        encrypt_job_id: 职位 id。

    Returns:
        职位或 `None`。
    """
    from jobpilot_platform_boss.jobs.store import JobStore

    with JobStore() as store:
        return store.get_job(encrypt_job_id)


def _job_from_snapshot(item: dict[str, Any]) -> Job:
    """职位已从库里删了，用 match 自带的快照拼个 Job。

    Args:
        item: 一条 match。

    Returns:
        快照拼出的 Job。
    """
    return Job(
        job_name=str(item.get("job_name") or ""),
        brand_name=str(item.get("brand_name") or ""),
        location=str(item.get("location") or ""),
        salary_desc=str(item.get("salary_desc") or ""),
        job_experience=str(item.get("job_experience") or ""),
        job_degree=str(item.get("job_degree") or ""),
        brand_industry=str(item.get("brand_industry") or ""),
        brand_scale_name=str(item.get("brand_scale_name") or ""),
        encrypt_job_id=str(item.get("encrypt_job_id") or ""),
        security_id=str(item.get("security_id") or ""),
        lid=str(item.get("lid") or ""),
    )


def _finalize(task: MatchTask, resume: Any, cfg: Any, llm_parse: dict[str, Any] | None) -> None:
    """聚合排序、写 analysis 行并把任务置为完成。

    Args:
        task: 匹配任务。
        resume: 简历骨架。
        cfg: LLM 配置。
        llm_parse: LLM 解析结果。
    """
    gaps: Counter[str] = Counter()
    for item in task.matches:
        for skill in item.get("missing_skills") or []:
            gaps[str(skill)] += 1
    ranked = sorted(task.matches, key=lambda m: m.get("match_score") or 0, reverse=True)

    safety_counts = Counter()
    for item in ranked:
        if item.get("company_blacklisted"):
            safety_counts["company_blacklisted"] += 1
        if item.get("jd_blacklisted"):
            safety_counts["jd_blacklisted"] += 1
        if not item.get("jd_rule_checked", False):
            safety_counts["jd_rule_unchecked"] += 1
        if item.get("auto_delivery_blocked"):
            safety_counts["auto_delivery_blocked"] += 1
    blacklist_summary = {
        "total": len(ranked),
        "company_blacklisted": safety_counts["company_blacklisted"],
        "jd_blacklisted": safety_counts["jd_blacklisted"],
        "jd_rule_unchecked": safety_counts["jd_rule_unchecked"],
        "auto_delivery_blocked": safety_counts["auto_delivery_blocked"],
        "safe_for_auto_delivery": sum(
            1 for item in ranked if not _auto_delivery_blocked(item)
        ),
    }

    payload = {
        "analysis_id": task.analysis_id,
        "kind": "match",
        "resume_id": resume.resume_id,
        "resume_title": resume.title,
        "created_at": task.created_at,
        "status": STATUS_DONE if task.status == STATUS_RUNNING else task.status,
        "llm": {"base_url": cfg.base_url, "model": cfg.model, "temperature": cfg.temperature},
        "resume_summary": {
            "skills": resume.skills[:20],
            "intent": (resume.sections.get("求职意向") or "")[:200],
            "summary": resume.summary,
            "llm": (llm_parse or {}).get("data") if llm_parse else None,
        },
        "matches": ranked,
        "blacklist_summary": blacklist_summary,
        "skill_gaps": [{"skill": k, "count": v} for k, v in gaps.most_common(15)],
        "top_recommendations": [
            m["encrypt_job_id"] for m in ranked if (m.get("match_score") or 0) >= 70
        ][:10],
        "errors": [m.get("error") for m in task.matches if m.get("error")],
        "deliveries": [],
    }
    save_analysis(payload)
    with task.lock:
        if task.status == STATUS_RUNNING:
            task.status = STATUS_DONE
        task.ended_at = time.time()
        task.matches = ranked
    task.push("finished", {"analysis_id": task.analysis_id})
