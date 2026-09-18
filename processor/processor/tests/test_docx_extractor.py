import pytest

from processor.extractors.base import ExtractionError
from processor.extractors.docx import DocxExtractor
from processor.models import BlockType


def test_extracts_headings_paragraphs_and_lists(sample_docx_path):
    doc = DocxExtractor().extract(sample_docx_path)

    assert len(doc.sections) == 2

    first = doc.sections[0]
    assert first.heading == "Introduction"
    assert first.heading_level == 1
    assert len(first.blocks) == 3
    assert first.blocks[0].type == BlockType.paragraph
    assert first.blocks[0].text == "This is the first paragraph."
    assert first.blocks[1].type == BlockType.list_item
    assert first.blocks[1].text == "Bullet one"
    assert first.blocks[2].type == BlockType.list_item
    assert first.blocks[2].text == "Bullet two"

    second = doc.sections[1]
    assert second.heading == "Background"
    assert second.heading_level == 2
    assert len(second.blocks) == 1
    assert second.blocks[0].text == "More detail here."

    # DOCX has no fixed page boundaries at parse time.
    assert all(block.page is None for section in doc.sections for block in section.blocks)


def test_raises_extraction_error_for_malformed_docx(tmp_path):
    bad_file = tmp_path / "bad.docx"
    bad_file.write_bytes(b"this is not a real docx file")

    with pytest.raises(ExtractionError):
        DocxExtractor().extract(str(bad_file))
