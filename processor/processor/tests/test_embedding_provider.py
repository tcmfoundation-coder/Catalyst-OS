import math

from processor.embedding import MODEL_DIMENSION, MODEL_NAME, get_default_provider
from processor.embedding.provider import FastEmbedProvider


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b)


def test_get_default_provider_returns_the_configured_model():
    provider = get_default_provider()
    assert provider.model_name == MODEL_NAME
    assert provider.dimension == MODEL_DIMENSION


def test_get_default_provider_returns_the_same_cached_instance():
    assert get_default_provider() is get_default_provider()


def test_embed_documents_returns_one_vector_per_text_at_the_expected_dimension():
    provider = get_default_provider()
    vectors = provider.embed_documents(["First chunk of text.", "A second, different chunk."])

    assert len(vectors) == 2
    assert all(len(vector) == MODEL_DIMENSION for vector in vectors)
    assert all(isinstance(component, float) for component in vectors[0])


def test_embed_query_returns_a_single_vector_at_the_expected_dimension():
    provider = get_default_provider()
    vector = provider.embed_query("What happens to memory when electricity is switched off?")

    assert len(vector) == MODEL_DIMENSION


def test_embedding_is_deterministic_for_the_same_text():
    provider = get_default_provider()
    first = provider.embed_documents(["Deterministic input text."])[0]
    second = provider.embed_documents(["Deterministic input text."])[0]

    assert first == second


def test_semantic_retrieval_matches_a_relevant_passage_over_an_unrelated_one():
    """The concrete example from the task spec: no shared keywords, but the
    query is genuinely about the same fact as the relevant passage."""
    provider = get_default_provider()

    relevant = "RAM is volatile memory and loses stored information when power is removed."
    unrelated = "The French Revolution began in 1789 and reshaped European politics."
    query = "What happens to memory when electricity is switched off?"

    relevant_vec, unrelated_vec = provider.embed_documents([relevant, unrelated])
    query_vec = provider.embed_query(query)

    sim_relevant = _cosine_similarity(query_vec, relevant_vec)
    sim_unrelated = _cosine_similarity(query_vec, unrelated_vec)

    assert sim_relevant > sim_unrelated
    assert sim_relevant > 0.6


def test_embed_query_and_embed_documents_are_both_usable_on_the_same_text():
    """embed_query and embed_documents are kept as separate methods so a
    future model that needs asymmetric query prefixing (unlike the current
    BAAI/bge-small-en-v1.5, which fastembed's own registry marks as not
    needing one) benefits automatically. For the current model they
    happen to produce the same vector for identical input — that's a
    property of this specific model, not a guarantee of the interface."""
    provider = get_default_provider()
    text = "Mitochondria are the powerhouse of the cell."

    as_document = provider.embed_documents([text])[0]
    as_query = provider.embed_query(text)

    assert len(as_document) == MODEL_DIMENSION
    assert len(as_query) == MODEL_DIMENSION


def test_fastembed_provider_can_be_constructed_with_an_explicit_cache_dir(tmp_path):
    provider = FastEmbedProvider(cache_dir=tmp_path / "custom-cache")
    vectors = provider.embed_documents(["A quick check that a fresh cache dir works."])

    assert len(vectors[0]) == MODEL_DIMENSION
    assert (tmp_path / "custom-cache").exists()
