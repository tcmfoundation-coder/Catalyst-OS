"""Normalization: the step between "whatever an extractor produced" and
"the canonical document the chunker can trust".

Extractors are all format-specific and each has its own reasons to emit
messy whitespace, stray empty lines, or edge-case empty sections. Rather
than making every extractor independently careful about that, normalization
is the one place that guarantees: no empty text, no blank sections, and
consistent whitespace — regardless of which extractor produced the input.
It operates on the same NormalizedDocument/Section/Block models extractors
already emit; there's no separate "raw" schema, because extractors already
produce the right *shape* — they just don't all produce clean *content*.
"""

from __future__ import annotations

from ..models import Block, DocumentMetadata, NormalizedDocument, Section


def _clean_text(text: str) -> str:
    """Collapses any run of whitespace (including newlines/tabs) to a single space."""
    return " ".join(text.split())


def _clean_optional_text(text: str | None) -> str | None:
    if text is None:
        return None
    cleaned = _clean_text(text)
    return cleaned or None


def _normalize_block(block: Block) -> Block | None:
    text = _clean_text(block.text)
    if not text:
        return None
    return block.model_copy(update={"text": text})


def _normalize_section(section: Section) -> Section | None:
    blocks = [b for b in (_normalize_block(block) for block in section.blocks) if b is not None]
    heading = _clean_optional_text(section.heading)
    if heading is None and not blocks:
        return None
    return Section(heading=heading, heading_level=section.heading_level if heading else None, blocks=blocks)


def _normalize_metadata(metadata: DocumentMetadata) -> DocumentMetadata:
    return metadata.model_copy(
        update={
            "title": _clean_optional_text(metadata.title),
            "author": _clean_optional_text(metadata.author),
        }
    )


def normalize_document(document: NormalizedDocument) -> NormalizedDocument:
    sections = [s for s in (_normalize_section(section) for section in document.sections) if s is not None]
    return NormalizedDocument(metadata=_normalize_metadata(document.metadata), sections=sections)
