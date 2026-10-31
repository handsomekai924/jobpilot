"""`boss_core` — 多平台契约与能力协议。

约定：本包零外部依赖，且不 import 任何其他 `boss_*` 包。
"""

from __future__ import annotations

from .errors import BossError
from .paths import default_data_dir, repo_root

__all__ = ["BossError", "default_data_dir", "repo_root"]
