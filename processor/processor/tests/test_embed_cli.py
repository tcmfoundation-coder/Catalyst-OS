import json
import subprocess
import sys
from pathlib import Path

import pytest

from processor.embed_cli import main, run


def test_run_documents_mode_returns_model_metadata_and_vectors():
    result = run("documents", ["First chunk.", "Second chunk."])

    assert result["ok"] is True
    assert result["model"] == "BAAI/bge-small-en-v1.5"
    assert result["dimension"] == 384
    assert len(result["embeddings"]) == 2
    assert all(len(vector) == 384 for vector in result["embeddings"])


def test_run_query_mode_returns_one_vector_per_query():
    result = run("query", ["What happens to memory when electricity is switched off?"])

    assert result["ok"] is True
    assert len(result["embeddings"]) == 1
    assert len(result["embeddings"][0]) == 384


def test_run_rejects_an_empty_list():
    with pytest.raises(ValueError, match="non-empty"):
        run("documents", [])


def test_run_rejects_a_blank_string_in_the_batch():
    with pytest.raises(ValueError, match="non-empty string"):
        run("documents", ["valid text", "   "])


def test_run_rejects_an_unknown_mode():
    with pytest.raises(ValueError, match="unknown mode"):
        run("summaries", ["some text"])


def test_main_prints_ok_false_json_and_exits_nonzero_for_non_array_stdin(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", __import__("io").StringIO(json.dumps({"not": "a list"})))

    exit_code = main(["--mode", "documents"])
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 1
    assert output["ok"] is False
    assert "error" in output and isinstance(output["error"], str) and output["error"]


def test_main_prints_ok_true_json_and_exits_zero_for_valid_input(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", __import__("io").StringIO(json.dumps(["Hello world."])))

    exit_code = main(["--mode", "documents"])
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert output["ok"] is True
    assert len(output["embeddings"]) == 1


def test_cli_subprocess_contract_holds_end_to_end():
    """One real subprocess invocation, exercising argparse, stdin, and
    __main__ — everything else in this file calls main()/run() in-process
    for speed."""
    proc = subprocess.run(
        [sys.executable, "-m", "processor.embed_cli", "--mode", "documents"],
        cwd=Path(__file__).resolve().parents[2],
        input=json.dumps(["A real subprocess round trip."]),
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert proc.returncode == 0, proc.stderr
    output = json.loads(proc.stdout.strip())
    assert output["ok"] is True
    assert output["dimension"] == 384
    assert len(output["embeddings"]) == 1
