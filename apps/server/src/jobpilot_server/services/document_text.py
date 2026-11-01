"""服务端 Word / PDF 文本提取入口：直接用 `jobpilot_ai.document_text`。"""

from __future__ import annotations

from jobpilot_ai.document_text import (
    ALLOWED_EXT,
    BINARY_EXTS,
    TEXT_EXTS,
    DocumentTextError,
    _tidy,
    ext_of,
    extract_docx,
    extract_pdf,
    extract_text,
)

__all__ = [
    "ALLOWED_EXT",
    "BINARY_EXTS",
    "TEXT_EXTS",
    "DocumentTextError",
    "ext_of",
    "extract_docx",
    "extract_pdf",
    "extract_text",
]
