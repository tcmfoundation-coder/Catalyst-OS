"""The output of chunking — what actually gets stored as a MaterialChunk in
MongoDB. This shape is deliberately RAG-shaped already (materialId/courseId/
userId get attached by Next.js when it persists these, not here — this
processor has no idea who owns the document or what database it lives in).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Chunk(BaseModel):
    # See DocumentMetadata's model_config comment in models/document.py —
    # same reasoning applies here.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    chunk_index: int
    text: str
    heading: str | None = None
    page_start: int | None = None
    page_end: int | None = None
    slide_start: int | None = None
    slide_end: int | None = None
