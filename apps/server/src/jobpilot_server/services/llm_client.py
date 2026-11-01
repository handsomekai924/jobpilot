"""服务端 LLM 客户端：包 `jobpilot_ai.llm`，把 AI 包错误翻成网页错误。"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from jobpilot_ai.errors import AIUpstreamError, AIValidationError
from jobpilot_ai.llm import (
    ChatResult,
    LLMClient as _AILLMClient,
    LLMConfig,
    _friendly_http_error,
    extract_json,
)

from ..errors import UpstreamError, ValidationWebError

__all__ = ["ChatResult", "LLMClient", "LLMConfig", "extract_json"]


class LLMClient(_AILLMClient):
    """网页层客户端：`AIValidationError` → 422，`AIUpstreamError` → 502。"""

    def chat_with_metadata(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> ChatResult:
        """发起一轮对话，回正文与 `finish_reason`。"""
        try:
            return super().chat_with_metadata(
                messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
            )
        except AIValidationError as exc:
            raise ValidationWebError(str(exc)) from exc
        except AIUpstreamError as exc:
            raise UpstreamError(str(exc)) from exc

    def list_models(self) -> list[str]:
        """打 `GET /models` 拉可用模型列表。"""
        try:
            return super().list_models()
        except AIValidationError as exc:
            raise ValidationWebError(str(exc)) from exc
        except AIUpstreamError as exc:
            raise UpstreamError(str(exc)) from exc
