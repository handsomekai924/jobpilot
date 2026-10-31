"""pytest 根配置。

放在项目根目录，使各 workspace 包在测试时可直接导入（无需安装为包）。
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SOURCE_DIRS = (
    ROOT / "apps" / "server" / "src",
    ROOT / "packages" / "core" / "src",
    ROOT / "packages" / "platform-base" / "src",
    ROOT / "packages" / "platform-boss" / "src",
    ROOT / "packages" / "browser-pool" / "src",
    ROOT / "packages" / "ai" / "src",
    ROOT / "packages" / "db" / "src",
)

# 逆序插入，保证 ROOT 留在 sys.path[0]：过渡期根目录仍有旧包，优先命中它们。
for entry in reversed((ROOT, *SOURCE_DIRS)):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))
