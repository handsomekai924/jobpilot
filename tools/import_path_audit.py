"""检查前端模块导入路径：`apps/web` 源码禁止相对/绝对导入，必须使用 `@/` 别名。

用法：

    python tools/import_path_audit.py                 # 默认扫 apps/web/src
    python tools/import_path_audit.py apps/web/src    # 指定路径

退出码 1 = 有 RELATIVE / ABSOLUTE / ABSOLUTE_ROOT 残留。

Attributes:
    DEFAULT_TARGET: 不传路径时扫描的目录。
    EXEMPT_PREFIX: 豁免的路径前缀；legacy JS 是浏览器原生 ESM，没有打包器。
    SKIP_DIRS: 不扫的目录。
    EXTS: 参与扫描的源码扩展名。
    ALIAS_PREFIX: 唯一允许的别名前缀。
    SRC_ROOT: 别名 `@/` 指向的根目录。
    PATTERNS: 匹配静态导入、副作用导入、动态导入与 `require()` 的正则。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from jsdoc_audit import strip_code

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_TARGET = "apps/web/src"
EXEMPT_PREFIX = (
    "apps/server/src/boss_server/static/legacy/",
    "packages/platform-boss/src/boss_platform_boss/assets/",
)
SKIP_DIRS = {".venv", "build", "dist", "__pycache__", ".git", "node_modules", ".idea"}
EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".vue"}
ALIAS_PREFIX = "@/"
SRC_ROOT = ROOT / "apps/web/src"

PATTERNS = (
    re.compile(r"\bfrom\s*([\"'])([^\"'\n]+)\1"),
    re.compile(r"\bimport\s*([\"'])([^\"'\n]+)\1"),
    re.compile(r"\bimport\s*\(\s*([\"'])([^\"'\n]+)\1"),
    re.compile(r"\brequire\s*\(\s*([\"'])([^\"'\n]+)\1"),
)

HARD_KINDS = {"RELATIVE", "ABSOLUTE", "ABSOLUTE_ROOT"}


def classify(spec: str) -> str | None:
    """判断一个模块 specifier 是否违规。

    Args:
        spec: 导入路径原文。

    Returns:
        违规类别；合规时返回 `None`。
    """
    if spec.startswith("."):
        return "RELATIVE"
    if spec.startswith("/"):
        return "ABSOLUTE"
    if spec.startswith(ALIAS_PREFIX):
        return None
    if spec.startswith("@"):
        return None
    head = spec.split("/", 1)[0]
    if (SRC_ROOT / head).exists():
        return "ABSOLUTE_ROOT"
    return None


def iter_files(paths: list[str]) -> list[Path]:
    """列出要扫描的源码文件。

    Args:
        paths: 显式给定的文件或目录；为空时扫 `apps/web/src`。

    Returns:
        排好序的文件列表。
    """
    base = [Path(p) for p in paths] if paths else [ROOT / DEFAULT_TARGET]
    found: set[Path] = set()
    for item in base:
        if not item.is_absolute():
            item = ROOT / item
        if item.is_file():
            if item.suffix in EXTS:
                found.add(item)
            continue
        for f in item.rglob("*"):
            if f.suffix not in EXTS:
                continue
            if any(part in SKIP_DIRS for part in f.parts):
                continue
            rel = f.relative_to(ROOT).as_posix() if ROOT in f.parents else f.as_posix()
            if any(rel.startswith(p) for p in EXEMPT_PREFIX):
                continue
            found.add(f)
    return sorted(found)


def check_file(path: Path, rel: str) -> list[tuple[str, int, str]]:
    """检查一个文件的导入路径。

    Args:
        path: 文件路径。
        rel: 相对仓库根的路径，用于报告。

    Returns:
        `(类别, 行号, specifier)` 列表。
    """
    src = path.read_text(encoding="utf-8")
    skeleton = strip_code(src)
    issues: list[tuple[str, int, str]] = []
    seen: set[int] = set()

    for pattern in PATTERNS:
        for m in pattern.finditer(src):
            keyword = m.start()
            if skeleton[keyword] == " ":
                continue
            if m.start(2) in seen:
                continue
            seen.add(m.start(2))
            kind = classify(m.group(2))
            if kind in HARD_KINDS:
                line = src.count("\n", 0, m.start(2)) + 1
                issues.append((kind, line, m.group(2)))
    return issues


def main(argv: list[str]) -> int:
    """跑检查并打印报告。

    Args:
        argv: 命令行参数（要扫描的路径）。

    Returns:
        退出码；有硬性问题时为 1。
    """
    files = iter_files(argv)
    counts: dict[str, int] = {}
    hard = 0
    for f in files:
        rel = f.relative_to(ROOT).as_posix() if ROOT in f.parents else f.as_posix()
        for kind, line, spec in check_file(f, rel):
            counts[kind] = counts.get(kind, 0) + 1
            print(f"HARD  {kind}  {rel}:{line}  {spec}")
            hard += 1
    print()
    print(f"checked {len(files)} files | hard={hard} | {counts}")
    return 1 if hard else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
