"""PDF extraction via pdfplumber.

Heading detection: pdfplumber exposes each character's font size
(`char["size"]`), which is a much more reliable signal than guessing from
text patterns (ALL CAPS, short lines, ...). We compute the document's
median font size and treat any short line whose font is notably larger
as a heading. This is a heuristic, not a real structural parse — PDF has
no concept of "heading" the way DOCX styles or PPTX title placeholders do
— so it will miss or misfire on unusually-formatted documents. That's an
accepted, documented limitation, not a bug to chase down here.
"""

from __future__ import annotations

from statistics import median

from .base import ExtractionError
from ..models import Block, BlockType, DocumentMetadata, NormalizedDocument, Section, SourceFormat

HEADING_SIZE_RATIO = 1.15
HEADING_MAX_CHARS = 100

# Below this average extractable characters per page, we treat the PDF as a
# scan with no real text layer, rather than pretending it has (near-)empty
# content. See models/document.py's DocumentMetadata.requires_ocr.
MIN_CHARS_PER_PAGE_FOR_TEXT = 20

_Line = tuple[str, float, int]  # (text, dominant_font_size, page_number)


class PdfExtractor:
    def extract(self, file_path: str) -> NormalizedDocument:
        import pdfplumber

        try:
            with pdfplumber.open(file_path) as pdf:
                pages = pdf.pages
                page_count = len(pages)
                page_lines = [self._extract_lines(page) for page in pages]
        except ExtractionError:
            raise
        except Exception as exc:  # pdfminer/pdfplumber raise several distinct error types for bad PDFs
            raise ExtractionError(f"Could not read PDF: {exc}") from exc

        if page_count == 0:
            return NormalizedDocument(
                metadata=DocumentMetadata(source_format=SourceFormat.pdf, page_count=0),
                sections=[],
            )

        total_chars = sum(len(text) for lines in page_lines for text, _size, _page in lines)
        requires_ocr = (total_chars / page_count) < MIN_CHARS_PER_PAGE_FOR_TEXT

        metadata = DocumentMetadata(
            source_format=SourceFormat.pdf,
            page_count=page_count,
            requires_ocr=requires_ocr,
        )

        if requires_ocr:
            return NormalizedDocument(metadata=metadata, sections=[])

        median_size = self._median_font_size(page_lines)
        sections = self._build_sections(page_lines, median_size)
        return NormalizedDocument(metadata=metadata, sections=sections)

    def _extract_lines(self, page) -> list[_Line]:
        """Groups a page's characters into lines of (text, font size, page number)."""
        chars = page.chars
        if not chars:
            return []

        lines: dict[float, list] = {}
        for char in chars:
            # Round `top` so characters on the same visual line (small
            # sub-pixel offsets) land in the same group.
            key = round(char["top"], 1)
            lines.setdefault(key, []).append(char)

        result: list[_Line] = []
        for top in sorted(lines.keys()):
            line_chars = lines[top]
            text = "".join(c["text"] for c in line_chars).strip()
            if not text:
                continue
            sizes = [c["size"] for c in line_chars if c.get("size")]
            dominant_size = median(sizes) if sizes else 0.0
            result.append((text, dominant_size, page.page_number))
        return result

    def _median_font_size(self, page_lines: list[list[_Line]]) -> float:
        sizes = [size for lines in page_lines for _text, size, _page in lines if size > 0]
        return median(sizes) if sizes else 0.0

    def _looks_like_heading(self, text: str, size: float, median_size: float) -> bool:
        if median_size <= 0 or len(text) > HEADING_MAX_CHARS:
            return False
        if text.endswith((".", ",", ";", ":")):
            return False
        return size >= median_size * HEADING_SIZE_RATIO

    def _build_sections(self, page_lines: list[list[_Line]], median_size: float) -> list[Section]:
        sections: list[Section] = []
        current_heading: str | None = None
        current_blocks: list[Block] = []
        paragraph_buffer: list[str] = []
        paragraph_page: int | None = None

        def flush_paragraph() -> None:
            nonlocal paragraph_buffer, paragraph_page
            if paragraph_buffer:
                current_blocks.append(
                    Block(type=BlockType.paragraph, text=" ".join(paragraph_buffer), page=paragraph_page)
                )
            paragraph_buffer = []
            paragraph_page = None

        def flush_section() -> None:
            nonlocal current_heading, current_blocks
            flush_paragraph()
            if current_heading is not None or current_blocks:
                sections.append(
                    Section(
                        heading=current_heading,
                        heading_level=1 if current_heading is not None else None,
                        blocks=current_blocks,
                    )
                )
            current_heading = None
            current_blocks = []

        for lines in page_lines:
            for text, size, page_number in lines:
                if self._looks_like_heading(text, size, median_size):
                    flush_paragraph()
                    flush_section()
                    current_heading = text
                    continue
                if paragraph_page is not None and paragraph_page != page_number:
                    flush_paragraph()
                paragraph_buffer.append(text)
                paragraph_page = page_number

        flush_section()
        return sections
