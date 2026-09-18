"""The registry that makes extractors swappable.

This is the "DocumentProcessor -> Extractor -> PDF/DOCX/PPTX" seam: the CLI
never imports PdfExtractor/DocxExtractor/PptxExtractor directly, it asks
this registry for "the extractor for format X". Adding a new format later
(or swapping PDF extraction for an OCR-capable one) means adding a branch
here, not touching the CLI or any other extractor.
"""

from __future__ import annotations

from typing import Protocol

from ..models import NormalizedDocument, SourceFormat


class UnsupportedFormatError(ValueError):
    """No extractor is registered for the requested format."""


class ExtractionError(RuntimeError):
    """A file claims to be a given format but can't actually be parsed as
    one — corrupt, empty, or not really that format at all."""


class Extractor(Protocol):
    def extract(self, file_path: str) -> NormalizedDocument: ...


def get_extractor(source_format: SourceFormat | str) -> Extractor:
    try:
        fmt = SourceFormat(source_format)
    except ValueError as exc:
        raise UnsupportedFormatError(f"No extractor registered for format: {source_format!r}") from exc

    # Imported lazily so each extractor's third-party dependency is only
    # required when that format is actually used.
    if fmt is SourceFormat.pdf:
        from .pdf import PdfExtractor

        return PdfExtractor()
    if fmt is SourceFormat.docx:
        from .docx import DocxExtractor

        return DocxExtractor()
    if fmt is SourceFormat.pptx:
        from .pptx import PptxExtractor

        return PptxExtractor()

    raise UnsupportedFormatError(f"No extractor registered for format: {source_format!r}")
