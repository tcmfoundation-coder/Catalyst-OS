from processor.models import Block, BlockType, DocumentMetadata, NormalizedDocument, Section, SourceFormat
from processor.normalization import normalize_document


def _doc(sections: list[Section]) -> NormalizedDocument:
    return NormalizedDocument(
        metadata=DocumentMetadata(source_format=SourceFormat.pdf, title="  My Title \n"),
        sections=sections,
    )


def test_collapses_messy_whitespace_in_blocks_and_metadata():
    doc = _doc(
        [
            Section(
                heading="  Heading   One  ",
                blocks=[Block(type=BlockType.paragraph, text="  line one\nline two  ")],
            )
        ]
    )

    result = normalize_document(doc)

    assert result.metadata.title == "My Title"
    assert result.sections[0].heading == "Heading One"
    assert result.sections[0].blocks[0].text == "line one line two"


def test_drops_blocks_that_are_empty_after_cleaning():
    doc = _doc(
        [
            Section(
                heading="Heading",
                blocks=[
                    Block(type=BlockType.paragraph, text="real content"),
                    Block(type=BlockType.paragraph, text="   \n  "),
                ],
            )
        ]
    )

    result = normalize_document(doc)

    assert len(result.sections[0].blocks) == 1
    assert result.sections[0].blocks[0].text == "real content"


def test_drops_sections_with_no_heading_and_no_surviving_blocks():
    doc = _doc(
        [
            Section(heading=None, blocks=[Block(type=BlockType.paragraph, text="   ")]),
            Section(heading="Kept", blocks=[Block(type=BlockType.paragraph, text="content")]),
        ]
    )

    result = normalize_document(doc)

    assert len(result.sections) == 1
    assert result.sections[0].heading == "Kept"


def test_treats_empty_string_metadata_as_none():
    doc = NormalizedDocument(
        metadata=DocumentMetadata(source_format=SourceFormat.docx, title="", author="   "),
        sections=[],
    )

    result = normalize_document(doc)

    assert result.metadata.title is None
    assert result.metadata.author is None
