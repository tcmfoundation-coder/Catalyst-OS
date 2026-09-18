import pytest

from processor.extractors.base import ExtractionError
from processor.extractors.pptx import PptxExtractor
from processor.models import BlockType


def test_each_slide_becomes_a_section_with_slide_numbers(sample_pptx_path):
    doc = PptxExtractor().extract(sample_pptx_path)

    assert doc.metadata.slide_count == 2
    assert len(doc.sections) == 2

    first = doc.sections[0]
    assert first.heading == "Welcome"
    assert len(first.blocks) == 2
    assert first.blocks[0].text == "First point"
    assert first.blocks[0].type == BlockType.paragraph
    assert first.blocks[0].slide == 1
    # The second paragraph was given level=1, i.e. a nested bullet.
    assert first.blocks[1].text == "Second point"
    assert first.blocks[1].type == BlockType.list_item
    assert first.blocks[1].slide == 1

    second = doc.sections[1]
    assert second.heading == "Details"
    assert second.blocks[0].slide == 2


def test_raises_extraction_error_for_malformed_pptx(tmp_path):
    bad_file = tmp_path / "bad.pptx"
    bad_file.write_bytes(b"this is not a real pptx file")

    with pytest.raises(ExtractionError):
        PptxExtractor().extract(str(bad_file))
