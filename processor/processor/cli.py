"""The explicit boundary between Python and Next.js.

This is a pure function wearing a CLI: given a local file path and a
format, it prints exactly one line of JSON to stdout and exits 0 on
success, 1 on failure. It never touches a database, object storage, or
the network — Next.js is responsible for getting the file onto local
disk first and for persisting whatever comes back. That keeps this
processor trivially testable (call it with a file, check the JSON) and
means it could later become an HTTP-called worker without changing this
contract at all — only how Next.js invokes it.

Contract:
  success: {"ok": true, "requiresOcr": bool, "metadata": {...}, "chunks": [...]}
  failure: {"ok": false, "error": "<human-readable message>"}

The broad exception handling below is deliberate: this process runs
against arbitrary user-uploaded files, so "something in a third-party
parsing library raised something" is an expected, routine outcome, not a
programming error to let crash. Every failure must still produce the
{"ok": false, ...} contract so Next.js can show the user a real error
instead of a silent hang or an unhandled subprocess crash.
"""

from __future__ import annotations

import argparse
import json
import sys

from .chunking import chunk_document
from .extractors import get_extractor
from .normalization import normalize_document


def run(file_path: str, source_format: str) -> dict:
    extractor = get_extractor(source_format)
    raw = extractor.extract(file_path)
    normalized = normalize_document(raw)
    chunks = chunk_document(normalized)

    return {
        "ok": True,
        "requiresOcr": normalized.metadata.requires_ocr,
        "metadata": normalized.metadata.model_dump(mode="json", by_alias=True),
        "chunks": [chunk.model_dump(mode="json", by_alias=True) for chunk in chunks],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="processor", description="Catalysts document processor")
    parser.add_argument("file_path", help="Local path to the file to process")
    parser.add_argument("--format", required=True, choices=["pdf", "docx", "pptx"], dest="source_format")
    args = parser.parse_args(argv)

    try:
        result = run(args.file_path, args.source_format)
    except Exception as exc:  # see module docstring: this boundary must never crash unhandled
        result = {"ok": False, "error": str(exc)}

    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
