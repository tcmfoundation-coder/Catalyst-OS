"""The explicit boundary between Python and Next.js for embeddings.

Same shape as cli.py: a pure function wearing a CLI. Texts come in as a
JSON array on stdin (argv isn't practical for a batch of chunk texts),
and exactly one line of JSON goes to stdout. Exit 0 on success, 1 on
failure. Never touches MongoDB, the vector index, or the network beyond
loading the local model on first use.

Contract:
  stdin:   JSON array of non-empty strings
  success: {"ok": true, "model": "<name>", "dimension": <int>, "embeddings": [[...], ...]}
  failure: {"ok": false, "error": "<human-readable message>"}

"documents" mode embeds each text as a passage/chunk. "query" mode embeds
each text as a search query (see embedding/provider.py for how and why
these two can differ depending on the configured model). Either way,
"embeddings" is index-aligned with the input array.
"""

from __future__ import annotations

import argparse
import json
import sys

from .embedding import get_default_provider


def run(mode: str, texts: list[str]) -> dict:
    if mode not in ("documents", "query"):
        raise ValueError(f"unknown mode: {mode!r}")
    if not texts:
        raise ValueError("texts must be a non-empty list")
    for text in texts:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("every text must be a non-empty string")

    provider = get_default_provider()
    if mode == "query":
        embeddings = [provider.embed_query(text) for text in texts]
    else:
        embeddings = provider.embed_documents(texts)

    return {
        "ok": True,
        "model": provider.model_name,
        "dimension": provider.dimension,
        "embeddings": embeddings,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="embed", description="Catalysts embedding CLI")
    parser.add_argument("--mode", required=True, choices=["documents", "query"])
    args = parser.parse_args(argv)

    try:
        payload = json.loads(sys.stdin.read())
        if not isinstance(payload, list):
            raise ValueError("stdin must be a JSON array of strings")
        result = run(args.mode, payload)
    except Exception as exc:  # see module docstring: this boundary must never crash unhandled
        result = {"ok": False, "error": str(exc)}

    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
