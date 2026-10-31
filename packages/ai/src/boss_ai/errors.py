"""AI 能力包的异常类型。

`boss_ai` 不依赖网页层：上游失败与配置/入参问题以这里两类抛出，
由调用方（如 server）映射成自己的错误码。
"""

from __future__ import annotations


class AIError(Exception):
    """AI 能力包的错误基类。"""


class AIUpstreamError(AIError):
    """AI 服务商侧失败：网络、状态码、响应格式对不上。"""


class AIValidationError(AIError):
    """配置或入参不满足，调用方该提示用户去修。"""
