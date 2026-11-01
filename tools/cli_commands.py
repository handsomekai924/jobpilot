"""列出项目里所有模块的命令与子命令。

独立脚本：不依赖登录/筛选的业务逻辑，只 introspect 各模块 `cli.build_parser()`
构造出来的 argparse 解析器，所以新增命令后不用改这里。

    python tools/cli_commands.py                # 人读表格
    python tools/cli_commands.py --json         # 机器可读
    python tools/cli_commands.py --module jobpilot_platform_boss.catalog
    python tools/cli_commands.py --options      # 连选项一起列
"""

from __future__ import annotations

import argparse
import importlib
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: workspace 的源码根；各包的 `cli.py` 按目录位置发现，不写死模块名。
SRC_ROOTS = (
    ROOT / "apps" / "server" / "src",
    ROOT / "packages" / "core" / "src",
    ROOT / "packages" / "platform-base" / "src",
    ROOT / "packages" / "platform-boss" / "src",
    ROOT / "packages" / "browser-pool" / "src",
    ROOT / "packages" / "ai" / "src",
    ROOT / "packages" / "db" / "src",
)


@dataclass(frozen=True)
class Option:
    """一个命令行选项（`--json` / `--out PATH` 这种）。

    Attributes:
        flags: 选项名，多个用 ` / ` 连接。
        help: 一行帮助文案。
        default: 展示用的默认值；无默认值为 `None`。
    """

    flags: str
    help: str = ""
    default: str | None = None


@dataclass(frozen=True)
class Command:
    """一个子命令；`options` 是它自己的选项（含父解析器并进来的）。

    Attributes:
        name: 子命令名。
        help: 一行帮助文案。
        options: 该子命令的选项表。
    """

    name: str
    help: str = ""
    options: tuple[Option, ...] = ()


@dataclass(frozen=True)
class ModuleCli:
    """一个可执行模块：`python -m <name> <command> …`。

    Attributes:
        name: 包名。
        help: 模块文档字符串首行。
        commands: 子命令表。
        global_options: 挂在父解析器上的选项表。
    """

    name: str
    help: str = ""
    commands: tuple[Command, ...] = ()
    global_options: tuple[Option, ...] = field(default_factory=tuple)


def _option_from_action(action) -> Option | None:
    """把 argparse 的 action 压成 `Option`；不是选项就返回 `None`。"""
    flags = " / ".join(action.option_strings or ())
    if not flags:
        return None
    default = action.default
    if default is None or default is argparse.SUPPRESS:
        shown = None
    elif isinstance(default, (str, int, float, bool)):
        shown = str(default)
    else:
        shown = repr(default)
    return Option(flags=flags, help=(action.help or "").strip(), default=shown)


def _options_of(parser: argparse.ArgumentParser) -> tuple[Option, ...]:
    """解析器上的普通选项（跳过子命令动作与 -h/--help）。"""
    out: list[Option] = []
    for action in parser._actions:  # noqa: SLF001 - argparse 没有公开的枚举接口
        if isinstance(action, argparse._SubParsersAction):  # noqa: SLF001
            continue
        if action.dest == "help":
            continue
        opt = _option_from_action(action)
        if opt is not None:
            out.append(opt)
    return tuple(out)


def _subparsers_of(parser: argparse.ArgumentParser) -> dict[str, argparse.ArgumentParser]:
    """取解析器上的子命令表（dest -> 子解析器）。"""
    for action in parser._actions:  # noqa: SLF001
        if isinstance(action, argparse._SubParsersAction):  # noqa: SLF001
            return dict(action.choices)
    return {}


def _subcommand_help(action) -> dict[str, str]:
    """子命令的一行帮助。argparse 把它挂在 `_choices_actions` 上，不在解析器上。"""
    return {item.dest: (item.help or "").strip() for item in getattr(action, "_choices_actions", [])}


def walk_parser(parser: argparse.ArgumentParser, name: str, help_text: str = "") -> ModuleCli:
    """把一个 `build_parser()` 的结果摊平成 `ModuleCli`。"""
    commands: list[Command] = []
    help_map: dict[str, str] = {}
    for action in parser._actions:  # noqa: SLF001
        if isinstance(action, argparse._SubParsersAction):  # noqa: SLF001
            help_map = _subcommand_help(action)
            break

    for cmd_name, cmd_parser in _subparsers_of(parser).items():
        first = (cmd_parser.description or "").strip().splitlines()
        commands.append(
            Command(
                name=cmd_name,
                help=help_map.get(cmd_name) or (first[0] if first else ""),
                options=_options_of(cmd_parser),
            )
        )

    summary = (help_text or (parser.description or "")).strip().splitlines()
    return ModuleCli(
        name=name,
        help=summary[0] if summary else "",
        commands=tuple(commands),
        global_options=_options_of(parser),
    )


def discover_modules(only: str | None = None) -> list[ModuleCli]:
    """在 workspace 源码根下找带 `cli.build_parser` 的包，逐个挖命令。

    Args:
        only: 只看这个模块名（如 `jobpilot_platform_boss.catalog`）；不给就全看。

    Returns:
        按模块名排序的 CLI 概览；导入/构造失败的模块直接跳过。
    """
    for src in reversed(SRC_ROOTS):
        if str(src) not in sys.path:
            sys.path.insert(0, str(src))

    found: list[ModuleCli] = []
    for name in _candidate_modules():
        if only and name != only:
            continue
        try:
            cli = importlib.import_module(f"{name}.cli")
        except Exception:
            continue
        build = getattr(cli, "build_parser", None)
        if build is None:
            continue
        parser = build()
        doc = (sys.modules[cli.__name__].__doc__ or "").strip().splitlines()
        found.append(walk_parser(parser, name, doc[0] if doc else ""))
    return found


def _candidate_modules() -> list[str]:
    """各源码根下含 `cli.py` 的包模块名（如 `jobpilot_platform_boss.jobs`）。"""
    names: list[str] = []
    for src in SRC_ROOTS:
        if not src.is_dir():
            continue
        for cli_path in src.rglob("cli.py"):
            if "__pycache__" in cli_path.parts:
                continue
            names.append(".".join(cli_path.parent.relative_to(src).parts))
    return sorted(names)


def _fmt_option(opt: Option) -> str:
    """拼一行选项。帮助里已写过「默认 …」就不再重复附加。"""
    text = f"{opt.flags}  {opt.help}".rstrip()
    if opt.default not in (None, "None") and "默认" not in (opt.help or ""):
        text += f"（默认 {opt.default}）"
    return text


def to_json(modules: list[ModuleCli], *, with_options: bool = False) -> str:
    """把命令表序列化成 JSON 字符串。"""
    payload = []
    for mod in modules:
        item = {"module": mod.name, "help": mod.help, "commands": []}
        for cmd in mod.commands:
            entry: dict = {"name": cmd.name, "help": cmd.help}
            if with_options:
                entry["options"] = [asdict(o) for o in cmd.options]
            item["commands"].append(entry)
        if with_options:
            item["globalOptions"] = [asdict(o) for o in mod.global_options]
        payload.append(item)
    return json.dumps(payload, ensure_ascii=False, indent=2)


def to_text(modules: list[ModuleCli], *, with_options: bool = False) -> str:
    """把命令表渲染成人读文本。"""
    lines: list[str] = []
    for mod in modules:
        lines.append(f"python -m {mod.name}  {('- ' + mod.help) if mod.help else ''}".rstrip())
        if not mod.commands:
            lines.append("  （没有子命令）")
            continue
        width = max(len(c.name) for c in mod.commands)
        for cmd in mod.commands:
            lines.append(f"  {cmd.name:<{width}}  {cmd.help}".rstrip())
            if with_options:
                for opt in cmd.options:
                    lines.append(f"      {_fmt_option(opt)}")
        if with_options and mod.global_options:
            lines.append("  全局选项:")
            for opt in mod.global_options:
                lines.append(f"      {_fmt_option(opt)}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_parser() -> argparse.ArgumentParser:
    """构造本脚本的命令行解析器。"""
    parser = argparse.ArgumentParser(
        prog="cli_commands",
        description="列出项目里所有模块的命令与子命令",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--json", action="store_true", help="按 JSON 输出")
    parser.add_argument("--options", action="store_true", help="连选项一起列")
    parser.add_argument("--module", default=None, help="只看这个模块（如 jobpilot_platform_boss.catalog）")
    return parser


def main(argv: list[str] | None = None) -> int:
    """打印命令表；一个模块都没找到时返回 2。"""
    _force_utf8_streams()
    args = build_parser().parse_args(argv)
    modules = discover_modules(only=args.module)
    if not modules:
        target = f"模块 {args.module}" if args.module else "项目根"
        print(f"✗ 在{target}下没找到带 cli.build_parser 的包", file=sys.stderr)
        return 2
    text = to_json(modules, with_options=args.options) if args.json else to_text(
        modules, with_options=args.options
    )
    sys.stdout.write(text)
    return 0


def _force_utf8_streams() -> None:
    """Windows 控制台默认 GBK，中文帮助会炸；统一按 UTF-8 出。"""
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name, None)
        buffer = getattr(stream, "buffer", None)
        if buffer is not None and getattr(stream, "encoding", "").lower() != "utf-8":
            setattr(
                sys,
                name,
                __import__("io").TextIOWrapper(buffer, encoding="utf-8", errors="replace"),
            )


if __name__ == "__main__":
    raise SystemExit(main())
