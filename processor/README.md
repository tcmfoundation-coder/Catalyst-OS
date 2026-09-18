# Catalysts document processor

Turns an uploaded PDF/DOCX/PPTX file into structured text chunks. This is a
standalone Python component — Next.js is still the main application; this
just does the one job of "file in, structured chunks out" (see
`processor/cli.py` for the exact contract).

## Setup

```bash
cd processor
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Running the tests

```bash
cd processor
.venv/bin/pytest
```

## Running it by hand

```bash
cd processor
.venv/bin/python -m processor.cli /path/to/file.pdf --format pdf
```

Prints one line of JSON: `{"ok": true, "requiresOcr": ..., "metadata": {...}, "chunks": [...]}`
on success, or `{"ok": false, "error": "..."}` on failure (exit code 1).

## Layout

```
processor/
  models/          Block, Section, NormalizedDocument, Chunk — the shared
                    shapes every stage of the pipeline speaks
  extractors/       one module per format (pdf.py, docx.py, pptx.py) plus a
                    registry (base.py) so the CLI never imports a specific
                    format's extractor directly
  normalization/   cleans up whatever an extractor produced (whitespace,
                    empty blocks/sections) into the canonical form
  chunking/        splits a NormalizedDocument into retrieval-sized chunks,
                    preserving heading/page/slide metadata
  cli.py           the only thing Next.js calls — see its docstring
  tests/           pytest, with fixture PDFs/DOCX/PPTX generated on the fly
```

## Adding a new format

Add `extractors/<format>.py` with an `extract(file_path) -> NormalizedDocument`
method, register it in `extractors/base.py`'s `get_extractor()`, and add it to
`cli.py`'s `--format` choices. Normalization and chunking need no changes —
they only ever see the shared `NormalizedDocument` shape.

## Scanned PDFs (OCR)

Not implemented yet. `extractors/pdf.py` detects when a PDF has little to no
extractable text and sets `metadata.requires_ocr = True` with no sections,
rather than pretending it extracted an empty document. Adding OCR later means
adding another PDF extraction strategy that runs when this flag is set — it
doesn't require redesigning anything else in this pipeline.
