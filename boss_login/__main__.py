"""过渡壳：`python -m boss_login` 入口。"""

from __future__ import annotations

import sys

from boss_platform_boss.auth.__main__ import _force_utf8_streams
from boss_platform_boss.auth.cli import main


if __name__ == "__main__":
    _force_utf8_streams()
    sys.exit(main())
