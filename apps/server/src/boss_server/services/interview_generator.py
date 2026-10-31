"""面试题生成（服务端薄封装）：提示词/校验/去重在 `boss_ai.interview`。

服务端负责注入 LLM 配置、题量区间与 token 上限，并把 AI 包错误翻成网页错误。
"""

from __future__ import annotations

from typing import Any, Sequence

from boss_ai.interview import (
    DIFFICULTIES,
    QUESTION_TYPES,
    SUPPLEMENT_BLOCK,
    SUPPLEMENT_MAX,
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    InterviewQuestion,
    build_messages,
    filter_new_questions,
    generate_questions as _ai_generate_questions,
    is_duplicate_question,
    parse_questions,
    question_count_for as _ai_question_count_for,
)

from .. import config as C
from ..errors import ValidationWebError
from .ai_bridge import translated
from .llm_client import LLMClient
from .llm_config_store import LLMConfig, load_config

__all__ = [
    "DIFFICULTIES",
    "QUESTION_TYPES",
    "SUPPLEMENT_BLOCK",
    "SUPPLEMENT_MAX",
    "SYSTEM_PROMPT",
    "USER_TEMPLATE",
    "InterviewQuestion",
    "build_messages",
    "filter_new_questions",
    "generate_questions",
    "is_duplicate_question",
    "parse_questions",
    "question_count_for",
]


def question_count_for(match_score: Any) -> int:
    """按匹配度定题量（配置区间内）。"""
    return _ai_question_count_for(
        match_score,
        low=C.INTERVIEW_QUESTION_MIN,
        high=C.INTERVIEW_QUESTION_MAX,
    )


def generate_questions(
    *,
    job_data: dict[str, Any],
    resume_content: str,
    match_result: dict[str, Any],
    question_count: int | None = None,
    question_type: str = "",
    existing_questions: Sequence[str] = (),
    llm: LLMClient | None = None,
) -> list[InterviewQuestion]:
    """调 LLM 生成一岗的面试题；未配置抛 `ValidationWebError`，输出非法抛 `ValueError`。"""
    client: LLMClient | None
    if llm is None:
        cfg: LLMConfig = load_config()
        if not cfg.configured:
            raise ValidationWebError(
                "AI 还没配置，请先到「AI 设置」填好 API Key / 接口地址 / 模型"
            )
        client = LLMClient(cfg)
    else:
        client = llm

    with translated():
        return _ai_generate_questions(
            job_data=job_data,
            resume_content=resume_content,
            match_result=match_result,
            question_count=question_count,
            question_type=question_type,
            existing_questions=existing_questions,
            llm=client,
            max_tokens=C.LLM_INTERVIEW_MAX_TOKENS,
            question_min=C.INTERVIEW_QUESTION_MIN,
            question_max=C.INTERVIEW_QUESTION_MAX,
        )
