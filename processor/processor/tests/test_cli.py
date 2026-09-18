import json
import subprocess
import sys
from pathlib import Path

import pytest

from processor.cli import main, run
from processor.extractors.base import UnsupportedFormatError


def test_run_succeeds_end_to_end_for_a_real_pdf(sample_pdf_path):
    result = run(sample_pdf_path, "pdf")

    assert result["ok"] is True
    assert result["requiresOcr"] is False
    assert result["metadata"]["sourceFormat"] == "pdf"
    assert result["metadata"]["pageCount"] == 2
    assert len(result["chunks"]) >= 1
    assert result["chunks"][0]["chunkIndex"] == 0


def test_run_raises_for_unsupported_format(sample_pdf_path):
    with pytest.raises(UnsupportedFormatError):
        run(sample_pdf_path, "txt")


def test_main_prints_ok_false_json_and_exits_nonzero_for_malformed_input(tmp_path, capsys):
    bad_file = tmp_path / "bad.pdf"
    bad_file.write_bytes(b"not a real pdf")

    exit_code = main([str(bad_file), "--format", "pdf"])
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 1
    assert output["ok"] is False
    assert "error" in output and isinstance(output["error"], str) and output["error"]


def test_main_prints_ok_true_json_and_exits_zero_for_a_real_file(sample_docx_path, capsys):
    exit_code = main([sample_docx_path, "--format", "docx"])
    output = json.loads(capsys.readouterr().out)

    assert exit_code == 0
    assert output["ok"] is True
    assert output["metadata"]["sourceFormat"] == "docx"


def test_cli_subprocess_contract_holds_end_to_end(sample_pptx_path):
    """One real subprocess invocation, exercising argparse and __main__ —
    everything else in this file calls main()/run() in-process for speed."""
    proc = subprocess.run(
        [sys.executable, "-m", "processor.cli", sample_pptx_path, "--format", "pptx"],
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        timeout=30,
    )

    assert proc.returncode == 0, proc.stderr
    output = json.loads(proc.stdout.strip())
    assert output["ok"] is True
    assert output["metadata"]["sourceFormat"] == "pptx"
    assert output["metadata"]["slideCount"] == 2
