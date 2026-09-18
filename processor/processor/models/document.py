"""The one shared representation every extractor (PDF/DOCX/PPTX) produces.

Nothing downstream (normalization, chunking, or eventually Next.js) should
need to know which file format a document came from — it should only ever
see a NormalizedDocument. That's the whole point of this module: it's the
seam between "format-specific extraction" and "everything else".
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class SourceFormat(str, Enum):
    pdf = "pdf"
    docx = "docx"
    pptx = "pptx"


class BlockType(str, Enum):
    heading = "heading"
    paragraph = "paragraph"
    list_item = "list_item"


class Block(BaseModel):
    """A single piece of content: one paragraph, one list item, or a heading line.

    page/slide are carried on the block (not the section) because a single
    section can span multiple pages in a PDF — tracking location per block
    lets the chunker later compute the correct page/slide range for any
    slice of a section, including a partial one.
    """

    type: BlockType
    text: str
    level: int | None = None  # heading level (1, 2, ...) or list nesting depth
    page: int | None = None  # 1-indexed PDF page; None for DOCX (no fixed pages) and PPTX
    slide: int | None = None  # 1-indexed PPTX slide; None for PDF and DOCX


class Section(BaseModel):
    """A heading and the blocks that fall under it, in reading order.

    For PDF, a new section starts whenever a heading is detected (or the
    whole document is one section if none are). For PPTX, each slide is its
    own section. For DOCX, a new section starts at each "Heading" style.
    """

    heading: str | None = None
    # 1 = top-level heading, 2 = subheading, etc. Sections stay a flat,
    # ordered list (not a nested tree) to keep chunking simple — this level
    # is metadata for later use (e.g. preferring to split chunks at
    # higher-level headings), not a hierarchy Catalysts currently renders.
    heading_level: int | None = None
    blocks: list[Block] = Field(default_factory=list)


class DocumentMetadata(BaseModel):
    # camelCase aliasing: this model is serialized straight into the JSON
    # that Next.js/TypeScript consumes, so it speaks that side's naming
    # convention on the wire rather than making the TS code translate
    # snake_case. Nothing else in this file crosses that boundary, so only
    # this model (and Chunk, in chunk.py) needs it.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str | None = None
    author: str | None = None
    page_count: int | None = None
    slide_count: int | None = None
    source_format: SourceFormat
    # True when a PDF has essentially no extractable text (i.e. it's a scan).
    # We deliberately don't attempt OCR yet — see extractors/pdf.py.
    requires_ocr: bool = False


class NormalizedDocument(BaseModel):
    metadata: DocumentMetadata
    sections: list[Section] = Field(default_factory=list)
