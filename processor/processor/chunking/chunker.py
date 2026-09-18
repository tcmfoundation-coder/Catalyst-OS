"""Structure-aware chunking.

The unit of chunking is the *section*, not a fixed character window: each
section (a heading and its blocks) becomes one chunk if it's small enough,
or several chunks if it's not — but every chunk produced from a section
still carries that section's heading and the correct page/slide range for
exactly the blocks it contains. This is what "structure-aware" means here,
as opposed to slicing the whole document's raw text into equal-sized
windows, which would frequently cut a chunk in half mid-thought and lose
which heading it belonged to.

MAX_CHUNK_CHARS is a size budget chosen to be comfortably retrieval-sized
later (an embedding model's context window), not a hard requirement today —
there's no embedding step yet. It's a plain module constant so it's easy
to tune once that's built.
"""

from __future__ import annotations

from ..models import Block, Chunk, NormalizedDocument

MAX_CHUNK_CHARS = 1500


def chunk_document(document: NormalizedDocument, max_chunk_chars: int = MAX_CHUNK_CHARS) -> list[Chunk]:
    chunks: list[Chunk] = []
    index = 0

    for section in document.sections:
        if not section.blocks:
            # A heading with nothing under it yet (e.g. a divider slide) is
            # still worth keeping — its text just is the heading.
            if section.heading:
                chunks.append(Chunk(chunk_index=index, text=section.heading, heading=section.heading))
                index += 1
            continue

        for group in _group_blocks(section.blocks, max_chunk_chars):
            text = "\n".join(block.text for block in group)
            pages = [b.page for b in group if b.page is not None]
            slides = [b.slide for b in group if b.slide is not None]
            chunks.append(
                Chunk(
                    chunk_index=index,
                    text=text,
                    heading=section.heading,
                    page_start=min(pages) if pages else None,
                    page_end=max(pages) if pages else None,
                    slide_start=min(slides) if slides else None,
                    slide_end=max(slides) if slides else None,
                )
            )
            index += 1

    return chunks


def _group_blocks(blocks: list[Block], max_chunk_chars: int) -> list[list[Block]]:
    """Greedily accumulates consecutive blocks so each group's joined text
    stays within max_chunk_chars. A single block longer than the budget is
    split on word boundaries as a last resort (never mid-word) and becomes
    its own group(s), since we never want to merge it with neighbors and
    exceed the budget by even more.
    """
    groups: list[list[Block]] = []
    current: list[Block] = []
    current_len = 0

    def flush() -> None:
        nonlocal current, current_len
        if current:
            groups.append(current)
        current = []
        current_len = 0

    for block in blocks:
        block_len = len(block.text)

        if block_len > max_chunk_chars:
            flush()
            for piece in _split_long_text(block.text, max_chunk_chars):
                groups.append([block.model_copy(update={"text": piece})])
            continue

        joined_len = block_len + (1 if current else 0)  # +1 for the "\n" join
        if current and current_len + joined_len > max_chunk_chars:
            flush()
            joined_len = block_len

        current.append(block)
        current_len += joined_len

    flush()
    return groups


def _split_long_text(text: str, max_chunk_chars: int) -> list[str]:
    """Splits text into word-boundary pieces no longer than max_chunk_chars.
    A single word longer than the budget is left intact rather than broken
    mid-word — an accepted, rare edge case for degenerate input.
    """
    words = text.split(" ")
    pieces: list[str] = []
    current_words: list[str] = []
    current_len = 0

    for word in words:
        joined_len = len(word) + (1 if current_words else 0)
        if current_words and current_len + joined_len > max_chunk_chars:
            pieces.append(" ".join(current_words))
            current_words = []
            current_len = 0
            joined_len = len(word)
        current_words.append(word)
        current_len += joined_len

    if current_words:
        pieces.append(" ".join(current_words))

    return pieces
