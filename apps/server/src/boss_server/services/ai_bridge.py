"""`boss_ai` 与网页层之间的异常翻译。

AI 包只抛 `AIValidationError` / `AIUpstreamError`；网页层需要 422 / 502 的
`WebError` 子类，薄封装用这里的上下文管理器统一转换。
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from boss_ai.errors import AIUpstreamError, AIValidationError

from ..errors import UpstreamError, ValidationWebError


@contextmanager
def translated() -> Iterator[None]:
    """把 AI 包的两类错误翻成网页层错误，其他异常原样上抛。"""
    try:
        yield
    except AIValidationError as exc:
        raise ValidationWebError(str(exc)) from exc
    except AIUpstreamError as exc:
        raise UpstreamError(str(exc)) from exc
