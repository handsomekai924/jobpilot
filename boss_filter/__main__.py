"""过渡壳：`python -m boss_filter` 入口。"""

from __future__ import annotations

import sys

from boss_platform_boss.catalog.__main__ import _force_utf8_streams
from boss_platform_boss.catalog.cli import main


if __name__ == "__main__":
    _force_utf8_streams()
    sys.exit(main())
