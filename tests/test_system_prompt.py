"""The model-facing prompt must match the exact markers and limits the gate enforces."""

from __future__ import annotations

from fastapi.testclient import TestClient

from isnad_core.api.app import create_app
from isnad_core.models import MatchStatus
from isnad_core.prompt import ARABIC_PREFERENCE_LINE, SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION
from isnad_core.streaming import CLOSE_MARKER, OPEN_MARKER


def test_prompt_uses_the_markers_the_gate_parses() -> None:
    assert OPEN_MARKER in SYSTEM_PROMPT
    assert CLOSE_MARKER in SYSTEM_PROMPT
    # The example block must be a usable instance of the protocol, not a sketch.
    assert (
        f"{OPEN_MARKER} source=<quran|hadith> language=<ar|en> reference=<reference>]]"
        in SYSTEM_PROMPT
    )


def test_prompt_teaches_escaping_literal_markers() -> None:
    line = next(text for text in SYSTEM_PROMPT.splitlines() if "backslash -" in text)

    assert f"\\{OPEN_MARKER}" in line
    assert f"\\{CLOSE_MARKER}" in line


def test_prompt_separates_match_status_from_authenticity() -> None:
    assert "textual correspondence only" in SYSTEM_PROMPT
    assert "fabricated or mawḍūʿ" in SYSTEM_PROMPT
    for status in MatchStatus:
        assert status.value in SYSTEM_PROMPT


def test_prompt_keeps_quotations_in_their_source_language() -> None:
    assert SYSTEM_PROMPT_VERSION == "isnad-citation-protocol-v2"
    assert "Answer in the language the user writes in." in SYSTEM_PROMPT
    assert "never translate inside citation markers" in SYSTEM_PROMPT
    assert ARABIC_PREFERENCE_LINE not in SYSTEM_PROMPT


def test_arabic_prompt_appends_one_answer_language_line() -> None:
    with TestClient(create_app()) as client:
        arabic = client.get("/v1/system-prompt", params={"lang": "ar"})
        english = client.get("/v1/system-prompt", params={"lang": "en"})

    assert arabic.status_code == 200
    assert arabic.json()["version"] == SYSTEM_PROMPT_VERSION
    assert arabic.json()["prompt"] == f"{SYSTEM_PROMPT}\n{ARABIC_PREFERENCE_LINE}"
    assert ARABIC_PREFERENCE_LINE == "أجب بالعربية الفصحى ما لم يكتب المستخدم بلغة أخرى."
    assert arabic.headers["content-language"] == "ar"
    assert english.json()["prompt"] == SYSTEM_PROMPT


def test_prompt_is_served_with_its_version_and_markers() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/v1/system-prompt")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == SYSTEM_PROMPT_VERSION
    assert payload["prompt"] == SYSTEM_PROMPT
    assert payload["block_open_marker"] == OPEN_MARKER
    assert payload["block_close_marker"] == CLOSE_MARKER


def test_capabilities_advertise_the_prompt_path_the_app_serves() -> None:
    with TestClient(create_app()) as client:
        capabilities = client.get("/v1/capabilities").json()
        path = capabilities["system_prompt_path"]
        assert client.get(path).status_code == 200

    assert path == "/v1/system-prompt"
