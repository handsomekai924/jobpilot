"""AI 能力包的默认参数（独立复用时的取值）。

服务端仍以 `jobpilot_server.config` 的 `LLM_*` 常量为准，调用时显式传入；
这里的值只在该包被单独使用、调用方没给参数时生效。

Attributes:
    LLM_TEMPERATURE: 默认采样温度。
    LLM_MAX_TOKENS: 单次回答默认上限。
    LLM_RESUME_PARSE_MAX_TOKENS: 简历解析首选的 token 上限。
    LLM_RESUME_PARSE_RETRY_MAX_TOKENS: 简历解析被截断时重试的 token 上限。
    LLM_MATCH_MAX_TOKENS: 人岗匹配单条的 token 上限。
    LLM_REVISE_MAX_TOKENS: 简历优化首选的 token 上限。
    LLM_REVISE_RETRY_MAX_TOKENS: 简历优化被截断时重试的 token 上限。
    LLM_INTERVIEW_MAX_TOKENS: 面试题生成的 token 上限。
    LLM_TIMEOUT: 请求超时（秒）。
    INTERVIEW_QUESTION_MIN: 每个职位最少生成几道题。
    INTERVIEW_QUESTION_MAX: 每个职位最多生成几道题。
    MATCH_CONCURRENCY: 匹配页默认并行度。
    ANALYZE_INTERVAL: 批量分析时单次 LLM 调用之间的硬间隔（秒）。
"""

from __future__ import annotations

LLM_TEMPERATURE = 0.7
LLM_MAX_TOKENS = 2048
LLM_RESUME_PARSE_MAX_TOKENS = 8192
LLM_RESUME_PARSE_RETRY_MAX_TOKENS = 16384
LLM_MATCH_MAX_TOKENS = 4096
LLM_REVISE_MAX_TOKENS = 16384
LLM_REVISE_RETRY_MAX_TOKENS = 32768
LLM_INTERVIEW_MAX_TOKENS = 8192
LLM_TIMEOUT = 120.0

INTERVIEW_QUESTION_MIN = 10
INTERVIEW_QUESTION_MAX = 15

MATCH_CONCURRENCY = 4
ANALYZE_INTERVAL = 0.6
