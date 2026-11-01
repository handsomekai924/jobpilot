"""服务端简历章节解析入口：直接用 `jobpilot_ai.resume_section_parser`。"""

from __future__ import annotations

from jobpilot_ai.resume_section_parser import (
    HEADING_PATTERN,
    extract_sections,
    get_section_titles,
    to_markdown,
)

__all__ = ["HEADING_PATTERN", "extract_sections", "get_section_titles", "to_markdown"]
