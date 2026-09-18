import pytest

from processor.extractors.base import ExtractionError
from processor.extractors.pdf import PdfExtractor


def test_extracts_headings_pages_and_merges_paragraph_lines(sample_pdf_path):
    doc = PdfExtractor().extract(sample_pdf_path)

    assert doc.metadata.page_count == 2
    assert doc.metadata.requires_ocr is False
    assert len(doc.sections) == 2

    first = doc.sections[0]
    assert first.heading == "Chapter One"
    # The two body lines on page 1 should merge into a single paragraph block.
    assert len(first.blocks) == 1
    assert "first paragraph of chapter one" in first.blocks[0].text
    assert "second sentence continuing" in first.blocks[0].text
    assert first.blocks[0].page == 1

    second = doc.sections[1]
    assert second.heading == "Chapter Two"
    assert len(second.blocks) == 1
    assert second.blocks[0].page == 2


def test_detects_scanned_pdf_as_requiring_ocr(blank_pdf_path):
    doc = PdfExtractor().extract(blank_pdf_path)

    assert doc.metadata.requires_ocr is True
    assert doc.metadata.page_count == 1
    assert doc.sections == []


def test_raises_extraction_error_for_malformed_pdf(tmp_path):
    bad_file = tmp_path / "bad.pdf"
    bad_file.write_bytes(b"this is not a real pdf file")

    with pytest.raises(ExtractionError):
        PdfExtractor().extract(str(bad_file))


def test_raises_extraction_error_for_missing_file(tmp_path):
    missing = tmp_path / "does-not-exist.pdf"

    with pytest.raises(ExtractionError):
        PdfExtractor().extract(str(missing))
