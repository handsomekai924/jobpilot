"""过渡壳：`python -m boss_jobs` 转发到 `boss_platform_boss.jobs`。"""

from __future__ import annotations

import sys

from boss_platform_boss.jobs.__main__ import _force_utf8_streams
from boss_platform_boss.jobs.cli import main

if __name__ == "__main__":
    _force_utf8_streams()
    sys.exit(main())
