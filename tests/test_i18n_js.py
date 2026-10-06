"""The interface catalog and its formatting, exercised under node.

Arabic is the interface's default language, so a key missing from one side, a
dropped placeholder, or a wrong plural form would reach every reader. node is
an optional tool: without it this test skips and the rest of the suite runs.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TEST_FILE = ROOT / "frontend" / "i18n.test.cjs"
NODE = shutil.which("node")


@pytest.mark.skipif(NODE is None, reason="node is not installed")
def test_interface_catalog_behaviour() -> None:
    result = subprocess.run(
        [NODE, str(TEST_FILE)],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=120,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "all assertions passed" in result.stdout
