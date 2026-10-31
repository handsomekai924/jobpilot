"""简历 LLM 固定模板解析（服务端薄封装）。

解析与提示词在 `boss_ai.resume_parser`；这里注入服务端 LLM 配置与 token 上限，
并把 AI 包错误翻成网页错误。
"""

from __future__ import annotations

from typing import Any

from boss_ai.resume_parser import (
    SYSTEM_PROMPT,
    TEMPLATE_FIELDS,
    USER_TEMPLATE,
    ResumeParseError,
    build_messages,
    normalize,
    parse_and_stamp as _ai_parse_and_stamp,
    parse_resume_llm as _ai_parse_resume_llm,
)

from .. import config as C
from .ai_bridge import translated
from .llm_client import LLMClient
from .llm_config_store import LLMConfig, load_config

__all__ = [
    "SYSTEM_PROMPT",
    "TEMPLATE_FIELDS",
    "USER_TEMPLATE",
    "ResumeParseError",
    "build_messages",
    "normalize",
    "parse_and_stamp",
    "parse_resume_llm",
]


def parse_resume_llm(
    content: str,
    *,
    config: LLMConfig | None = None,
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """LLM 固定模板解析简历原文，回模板形状的 dict。"""
    cfg = config
    if llm is None and cfg is None:
        cfg = load_config()
    with translated():
        return _ai_parse_resume_llm(
            content,
            config=cfg,
            llm=llm,
            max_tokens=C.LLM_RESUME_PARSE_MAX_TOKENS,
            retry_max_tokens=C.LLM_RESUME_PARSE_RETRY_MAX_TOKENS,
        )


def parse_and_stamp(
    content: str,
    *,
    model: str = "",
    config: LLMConfig | None = None,
    llm: LLMClient | None = None,
) -> dict[str, Any]:
    """解析并打上时间戳 / 模型名，回 `meta.llm` 的形状。"""
    cfg = config
    if llm is None and cfg is None:
        cfg = load_config()
    with translated():
        return _ai_parse_and_stamp(
            content,
            model=model,
            config=cfg,
            llm=llm,
            max_tokens=C.LLM_RESUME_PARSE_MAX_TOKENS,
            retry_max_tokens=C.LLM_RESUME_PARSE_RETRY_MAX_TOKENS,
        )
