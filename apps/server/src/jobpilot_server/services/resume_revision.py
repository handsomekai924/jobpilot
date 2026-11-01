"""简历优化（服务端薄封装）：装配/提示词/生成在 `jobpilot_ai.resume_revision`。

服务端负责读底稿、注入 LLM 配置与 token 上限，并把 AI 包错误翻成网页错误。
"""

from __future__ import annotations

from typing import Any, Sequence

from jobpilot_ai.resume_revision import (
    MAX_TARGET_JOBS,
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    assemble_target_block,
    build_diff,
    build_messages,
    generate_revision as _ai_generate_revision,
    markdown_to_text,
)

from .. import config as C
from ..errors import ValidationWebError
from .ai_bridge import translated
from .llm_client import LLMClient
from .llm_config_store import LLMConfig, load_config
from .resume_store import load_resume

__all__ = [
    "MAX_TARGET_JOBS",
    "SYSTEM_PROMPT",
    "USER_TEMPLATE",
    "assemble_target_block",
    "build_diff",
    "build_messages",
    "generate_revision",
    "markdown_to_text",
]


def generate_revision(
    *,
    resume_id: str,
    jobs: Sequence[Any],
    llm: LLMClient | None = None,
    target_json: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """跑一次简历优化：读底稿 → 调 `jobpilot_ai` 生成 → 回 `(revised_md, changes)` 形状。

    LLM 未配置抛 `ValidationWebError`，简历不存在抛 `FileNotFoundError`，
    输出非法 JSON 或长度截断抛 `ValueError`。
    """
    client: LLMClient | None
    if llm is None:
        cfg: LLMConfig = load_config()
        if not cfg.configured:
            raise ValidationWebError(
                "LLM 还没配置，请先到「模型」页填好 API Key / Base URL / 模型名"
            )
        client = LLMClient(cfg)
    else:
        client = llm

    resume = load_resume(resume_id)
    with translated():
        return _ai_generate_revision(
            resume_raw=resume.raw or "",
            resume_title=resume.title,
            jobs=jobs,
            llm=client,
            target_json=target_json,
            max_tokens=C.LLM_REVISE_MAX_TOKENS,
            retry_max_tokens=C.LLM_REVISE_RETRY_MAX_TOKENS,
        )
