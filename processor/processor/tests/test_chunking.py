from processor.chunking import chunk_document
from processor.models import Block, BlockType, DocumentMetadata, NormalizedDocument, Section, SourceFormat


def _doc(sections: list[Section]) -> NormalizedDocument:
    return NormalizedDocument(metadata=DocumentMetadata(source_format=SourceFormat.pdf), sections=sections)


def test_small_section_becomes_a_single_chunk():
    doc = _doc(
        [
            Section(
                heading="Intro",
                blocks=[
                    Block(type=BlockType.paragraph, text="Short paragraph one.", page=1),
                    Block(type=BlockType.paragraph, text="Short paragraph two.", page=1),
                ],
            )
        ]
    )

    chunks = chunk_document(doc)

    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].heading == "Intro"
    assert "paragraph one" in chunks[0].text
    assert "paragraph two" in chunks[0].text
    assert chunks[0].page_start == 1
    assert chunks[0].page_end == 1


def test_oversized_section_splits_into_multiple_chunks_preserving_heading_and_pages():
    blocks = [
        Block(type=BlockType.paragraph, text="A" * 40, page=1),
        Block(type=BlockType.paragraph, text="B" * 40, page=2),
        Block(type=BlockType.paragraph, text="C" * 40, page=3),
        Block(type=BlockType.paragraph, text="D" * 40, page=4),
    ]
    doc = _doc([Section(heading="Long Chapter", blocks=blocks)])

    chunks = chunk_document(doc, max_chunk_chars=90)

    assert len(chunks) > 1
    assert all(c.heading == "Long Chapter" for c in chunks)
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))

    # No text was lost or duplicated across the split.
    reconstructed = "\n".join(c.text for c in chunks)
    for block in blocks:
        assert block.text in reconstructed

    # Each chunk's page range reflects only the blocks it actually contains,
    # not the whole section's range.
    assert chunks[0].page_start == 1
    assert chunks[-1].page_end == 4
    for chunk in chunks:
        assert chunk.page_start is not None
        assert chunk.page_end is not None
        assert len(chunk.text) <= 90


def test_section_with_only_a_heading_becomes_a_heading_only_chunk():
    doc = _doc([Section(heading="Just A Divider", blocks=[])])

    chunks = chunk_document(doc)

    assert len(chunks) == 1
    assert chunks[0].text == "Just A Divider"
    assert chunks[0].heading == "Just A Divider"


def test_document_with_no_sections_produces_no_chunks():
    assert chunk_document(_doc([])) == []


def test_single_block_larger_than_budget_is_split_on_word_boundaries():
    long_text = " ".join(["word"] * 50)
    doc = _doc(
        [Section(heading="Big", blocks=[Block(type=BlockType.paragraph, text=long_text, page=1)])]
    )

    chunks = chunk_document(doc, max_chunk_chars=50)

    assert len(chunks) > 1
    assert all(c.heading == "Big" for c in chunks)
    for chunk in chunks:
        assert len(chunk.text) <= 50
        assert not chunk.text.startswith(" ")
        assert not chunk.text.endswith(" ")

    reconstructed_words = " ".join(c.text for c in chunks).split(" ")
    assert reconstructed_words.count("word") == 50
