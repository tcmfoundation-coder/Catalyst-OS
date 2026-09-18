"""Local embedding model, behind an EmbeddingProvider seam.

FastEmbedProvider is the only implementation today: a local, pretrained
ONNX model (BAAI/bge-small-en-v1.5, MIT-licensed, 384-dim, retrieval-tuned,
~67MB quantized weights) run through fastembed/onnxruntime, entirely on
CPU with no network calls at inference time. Everything upstream of
get_default_provider() only sees the EmbeddingProvider protocol, so an
ExternalEmbeddingProvider (e.g. a hosted embedding API) could be added
later without changing embed_cli.py or anything above it.

fastembed's TextEmbedding distinguishes documents from queries via embed()
vs. query_embed(). Some retrieval-tuned models require a query-only
instruction prefix for good asymmetric retrieval quality; fastembed
applies that prefix internally when a model needs it. For the specific
model selected here (BAAI/bge-small-en-v1.5), fastembed's own model
registry marks prefixing "not so necessary" and query_embed() is
currently equivalent to embed() — verified directly against fastembed's
source (fastembed/text/onnx_embedding.py's model description, and
TextEmbeddingBase.query_embed()'s default implementation, which this
model does not override). embed_documents()/embed_query() are still kept
as two methods, matching fastembed's own document/query distinction, so a
future model swap that *does* need prefixing benefits automatically
without any caller needing to change.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

MODEL_NAME = "BAAI/bge-small-en-v1.5"
MODEL_DIMENSION = 384

# processor/processor/embedding/provider.py -> parents[2] is processor/
DEFAULT_CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache" / "fastembed"


class EmbeddingProvider(Protocol):
    model_name: str
    dimension: int

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class FastEmbedProvider:
    model_name = MODEL_NAME
    dimension = MODEL_DIMENSION

    def __init__(self, cache_dir: str | Path | None = None) -> None:
        from fastembed import TextEmbedding

        resolved_cache_dir = Path(cache_dir or os.environ.get("EMBEDDING_MODEL_CACHE_DIR") or DEFAULT_CACHE_DIR)
        resolved_cache_dir.mkdir(parents=True, exist_ok=True)
        self._model = TextEmbedding(model_name=self.model_name, cache_dir=str(resolved_cache_dir))

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self._model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        vector = next(iter(self._model.query_embed(text)))
        return vector.tolist()


_default_provider: EmbeddingProvider | None = None


def get_default_provider() -> EmbeddingProvider:
    """Lazily constructs and caches the process-wide provider so the (slow,
    one-time) model load happens at most once per embed_cli.py invocation,
    regardless of how many texts are embedded in that batch."""
    global _default_provider
    if _default_provider is None:
        _default_provider = FastEmbedProvider()
    return _default_provider
