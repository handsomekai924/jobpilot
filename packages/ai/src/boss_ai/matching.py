"""人岗匹配的纯提示词与结果整理（不碰任务运行时与状态库）。

任务调度、落库与取消留在服务端；这里只负责把简历/职位装成提示词、
调 LLM、把回复收成定长字段。

Attributes:
    SYSTEM_PROMPT: 人岗匹配的系统提示词。
    USER_TEMPLATE: 单条职位的用户提示词模板。
    GREETING_SYSTEM_PROMPT: 只重打招呼语的短系统提示词。
    GREETING_USER_TEMPLATE: 只重打招呼语的用户提示词模板。
"""

from __future__ import annotations

from typing import Any

from . import config as AI_CONFIG
from .llm import LLMClient, extract_json

SYSTEM_PROMPT = (
    "你是资深互联网猎头，擅长人岗匹配。"
    "只输出一个 JSON 对象，不要任何解释文字或代码围栏。"
    "注意立场："
    "pros / cons / advice 是给求职者看的评估，"
    "而 greeting 是求职者本人发给招聘方 HR 的一条私信，"
    "一律用求职者第一人称「我」写，绝不能写成招聘方/HR 的口吻。"
)

USER_TEMPLATE = """# 简历（结构化摘要）
{resume_brief}

# 目标职位
- 岗位：{job_name}
- 公司：{brand_name}（{brand_industry} / {brand_scale_name}）
- 地点：{location}
- 薪资：{salary_desc}
- 经验/学历：{job_experience} / {job_degree}
- 标签：{job_labels}
- 技能要求：{job_skills}

# 职位描述（JD）
{job_desc}

请评估人岗匹配度，输出 JSON：
{{
  "match_score": 0-100 的整数,
  "matched_skills": ["简历与职位都有的技能"],
  "missing_skills": ["职位要但简历没有的技能"],
  "verdict": "一句话结论",
  "pros": ["求职者相对这个岗位的亮点，2-4 条"],
  "cons": ["相对这个岗位的短板，2-4 条"],
  "advice": "给求职者的建议",
  "greeting": "{greeting_requirement}"
}}
"""

GREETING_SYSTEM_PROMPT = (
    "你是资深互联网猎头，擅长写求职打招呼私信。"
    "只输出私信正文本身，不要任何解释、引号或代码围栏。"
    "立场：这是求职者本人发给招聘方 HR 的私信，一律用第一人称「我」写，"
    "绝不能写成招聘方/HR 的口吻。"
)

GREETING_USER_TEMPLATE = """# 简历（结构化摘要）
{resume_brief}

# 目标职位
- 岗位：{job_name}
- 公司：{brand_name}（{brand_industry} / {brand_scale_name}）
- 地点：{location}
- 薪资：{salary_desc}
- 经验/学历：{job_experience} / {job_degree}
- 标签：{job_labels}
- 技能要求：{job_skills}

# 职位描述（JD）
{job_desc}

请按以下要求写一条私信：
- {greeting_requirement}
- 只输出私信正文，不要引号、不要解释"""


def resume_brief(resume: Any, llm_parse: dict[str, Any] | None) -> str:
    """组装 prompt 里的简历块：优先 LLM 结构（summary/skills/work/intent）。

    Args:
        resume: 简历骨架（读 `sections` / `skills` / `summary`）。
        llm_parse: LLM 解析结果。

    Returns:
        简历摘要文本。
    """
    lines: list[str] = []
    data = (llm_parse or {}).get("data") if isinstance(llm_parse, dict) else None
    if isinstance(data, dict):
        intent = data.get("intent") if isinstance(data.get("intent"), dict) else {}
        parts = [str(intent.get(k) or "").strip() for k in ("position", "city", "salary")]
        parts = [p for p in parts if p]
        if parts:
            lines.append(f"- 求职意向：{' / '.join(parts)}")
        skills = data.get("skills")
        if isinstance(skills, list) and skills:
            lines.append(f"- 技能标签：{'、'.join(str(s) for s in skills[:24])}")
        summary = str(data.get("summary") or "").strip()
        if summary:
            lines.append(f"- 摘要：{summary[:500]}")
        for w in (data.get("work") or [])[:3]:
            if not isinstance(w, dict):
                continue
            company = str(w.get("company") or "").strip()
            title = str(w.get("title") or "").strip()
            period = str(w.get("period") or "").strip()
            head = " · ".join(p for p in (company, title, period) if p)
            highs = [str(h) for h in (w.get("highlights") or [])[:3] if str(h).strip()]
            if head:
                lines.append(f"- 工作：{head}")
            for h in highs:
                lines.append(f"  · {h}")

    if not lines:
        intent = (resume.sections.get("求职意向") or "").strip()
        if intent:
            lines.append(f"- 求职意向：{intent[:120]}")
        skills = resume.skills[:20]
        if skills:
            lines.append(f"- 技能标签：{'、'.join(skills)}")
        summary = (resume.summary or "").strip()
        if summary:
            lines.append(f"- 摘要：{summary[:400]}")
        work = (resume.sections.get("工作经历") or resume.sections.get("项目经历") or "").strip()
        if work:
            lines.append("- 经历摘录：")
            lines.append(work[:500])

    return "\n".join(lines) or "- （简历为空）"


def job_desc_block(job: Any) -> str:
    """拼提示词里的 JD 块。

    Args:
        job: 职位。

    Returns:
        JD 正文；没抓到则用标签/技能兜底。
    """
    desc = (job.job_desc or "").strip()
    if desc:
        return desc[:1500]
    bits = [b for b in (job.job_labels + job.skills) if b]
    return "（未抓到 JD）标签/技能：" + ("、".join(bits[:12]) if bits else "无")


def match_one(
    llm: LLMClient,
    resume_brief_text: str,
    job: Any,
    *,
    greeting_requirement: str,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """单条职位跑一次 LLM 匹配；LLM 没回合法 JSON 时抛 `ValueError`。

    Args:
        llm: LLM 客户端。
        resume_brief_text: 简历摘要块。
        job: 职位。
        greeting_requirement: 招呼语约束（由调用方现读设置后传入）。
        max_tokens: token 上限；缺省用包内默认值。

    Returns:
        模板形状的匹配结果。
    """
    token_limit = max_tokens if max_tokens is not None else AI_CONFIG.LLM_MATCH_MAX_TOKENS
    user = USER_TEMPLATE.format(
        resume_brief=resume_brief_text,
        job_name=job.job_name,
        brand_name=job.brand_name,
        brand_industry=job.brand_industry or "-",
        brand_scale_name=job.brand_scale_name or "-",
        location=job.location or "-",
        salary_desc=job.salary_desc or "-",
        job_experience=job.job_experience or "-",
        job_degree=job.job_degree or "-",
        job_labels="、".join(job.job_labels[:12]) or "-",
        job_skills="、".join(job.skills[:12]) or "-",
        job_desc=job_desc_block(job),
        greeting_requirement=greeting_requirement,
    )
    raw = llm.chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        max_tokens=token_limit,
    )
    data = extract_json(raw)
    if data is None:
        raw = llm.chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user + "\n\n请严格只输出 JSON 对象。"},
            ],
            max_tokens=token_limit,
        )
        data = extract_json(raw)
    if data is None:
        raise ValueError("LLM 没回合法 JSON")

    return {
        "match_score": int(data.get("match_score") or 0),
        "matched_skills": [str(s) for s in (data.get("matched_skills") or [])][:12],
        "missing_skills": [str(s) for s in (data.get("missing_skills") or [])][:12],
        "verdict": str(data.get("verdict") or ""),
        "pros": [str(p) for p in (data.get("pros") or [])][:6],
        "cons": [str(c) for c in (data.get("cons") or [])][:6],
        "advice": str(data.get("advice") or ""),
        "greeting": str(data.get("greeting") or ""),
    }


def greeting_fields(item: dict[str, Any], job: Any | None) -> dict[str, str]:
    """招呼语 prompt 的职位块。

    Args:
        item: 一条 match。
        job: 库里读到的职位；没有则退回 match 摘要。

    Returns:
        模板占位字段。
    """
    if job is not None:
        return {
            "job_name": job.job_name,
            "brand_name": job.brand_name,
            "brand_industry": job.brand_industry or "-",
            "brand_scale_name": job.brand_scale_name or "-",
            "location": job.location or "-",
            "salary_desc": job.salary_desc or "-",
            "job_experience": job.job_experience or "-",
            "job_degree": job.job_degree or "-",
            "job_labels": "、".join(job.job_labels[:12]) or "-",
            "job_skills": "、".join(job.skills[:12]) or "-",
            "job_desc": job_desc_block(job),
        }
    return {
        "job_name": str(item.get("job_name") or "-"),
        "brand_name": str(item.get("brand_name") or "-"),
        "brand_industry": str(item.get("brand_industry") or "-"),
        "brand_scale_name": str(item.get("brand_scale_name") or "-"),
        "location": str(item.get("location") or "-"),
        "salary_desc": str(item.get("salary_desc") or "-"),
        "job_experience": str(item.get("job_experience") or "-"),
        "job_degree": str(item.get("job_degree") or "-"),
        "job_labels": "-",
        "job_skills": "-",
        "job_desc": "（职位已不在库里，按上面的字段写）",
    }


def build_greeting_messages(
    *,
    resume_brief_text: str,
    greeting_requirement: str,
    fields: dict[str, str],
) -> list[dict[str, str]]:
    """拼招呼语重生成的 chat 消息。

    Args:
        resume_brief_text: 简历摘要块。
        greeting_requirement: 招呼语约束。
        fields: 职位块占位字段（`greeting_fields` 的返回）。

    Returns:
        system + user 两条消息。
    """
    user = GREETING_USER_TEMPLATE.format(
        resume_brief=resume_brief_text,
        greeting_requirement=greeting_requirement,
        **fields,
    )
    return [
        {"role": "system", "content": GREETING_SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]


def clean_greeting(raw: str) -> str:
    """把 LLM 回话收成一条正文：JSON 里的 greeting 优先，再退回纯文本并去围栏/引号。

    Args:
        raw: LLM 原文。

    Returns:
        清理后的招呼语。
    """
    text = str(raw or "").strip()
    if not text:
        return ""
    data = extract_json(text)
    if isinstance(data, dict) and data.get("greeting"):
        text = str(data["greeting"]).strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
    pairs = {'"': '"', "'": "'", "「": "」", "『": "』"}
    if len(text) >= 2 and text[0] in pairs and text[-1] == pairs[text[0]]:
        text = text[1:-1].strip()
    return text[:300]
