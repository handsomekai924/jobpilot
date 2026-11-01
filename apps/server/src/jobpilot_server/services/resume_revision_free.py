"""简历自由优化（服务端薄封装）：提示词/预设/生成在 `jobpilot_ai.resume_revision_free`。

服务端负责读底稿、注入 LLM 配置与 token 上限，并把 AI 包错误翻成网页错误。
"""

from __future__ import annotations

from typing import Any

from jobpilot_ai.resume_revision_free import (
    PRESET_PROMPTS,
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    build_messages,
    generate_free_revision as _ai_generate_free_revision,
    get_preset_categories,
    get_presets_by_category,
)

from .. import config as C
from ..errors import ValidationWebError
from .ai_bridge import translated
from .llm_client import LLMClient
from .llm_config_store import LLMConfig, load_config
from .resume_store import load_resume

__all__ = [
    "PRESET_PROMPTS",
    "SYSTEM_PROMPT",
    "USER_TEMPLATE",
    "build_messages",
    "generate_free_revision",
    "get_preset_categories",
    "get_presets_by_category",
]


def generate_free_revision(
    *,
    resume_id: str,
    selected_sections: list[str],
    optimization_prompt: str,
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """跑一次简历自由优化：按用户选择的章节和提示词优化；LLM 未配置、简历不存在或输出非法/截断时抛错。"""
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
        return _ai_generate_free_revision(
            resume_raw=resume.raw or "",
            resume_title=resume.title,
            selected_sections=selected_sections,
            optimization_prompt=optimization_prompt,
            llm=client,
            max_tokens=C.LLM_REVISE_MAX_TOKENS,
            retry_max_tokens=C.LLM_REVISE_RETRY_MAX_TOKENS,
        )
