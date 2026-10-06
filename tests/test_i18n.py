"""Message catalog completeness, locale negotiation, and English-contract stability."""

from __future__ import annotations

import re
import string

import pytest

from isnad_core.engine import VerificationEngine
from isnad_core.i18n import (
    MESSAGES,
    SUPPORTED_LOCALES,
    Message,
    negotiate_locale,
    normalize_locale,
    parse_accept_language,
    render,
)
from isnad_core.models import MatchStatus, VerificationInput, VerificationResult
from isnad_core.quran import QuranArabicVerifier

_ARABIC_LETTER = re.compile(r"[ء-ي]")


def _placeholders(template: str) -> set[str]:
    return {field for _, field, _, _ in string.Formatter().parse(template) if field is not None}


@pytest.mark.parametrize("key", sorted(MESSAGES))
def test_every_message_has_both_locales_with_matching_placeholders(key: str) -> None:
    entry = MESSAGES[key]

    assert set(entry) == set(SUPPORTED_LOCALES)
    assert entry["en"].strip()
    assert entry["ar"].strip()
    assert _placeholders(entry["ar"]) == _placeholders(entry["en"])
    assert _ARABIC_LETTER.search(entry["ar"]), f"{key} has no Arabic text"


def test_every_status_has_a_label_and_meaning() -> None:
    for status in MatchStatus:
        assert f"status.{status.value}.label" in MESSAGES
        assert f"status.{status.value}.meaning" in MESSAGES


def test_arabic_explanations_never_assert_fabrication() -> None:
    # Wherever the Arabic catalog mentions fabrication, it is to deny the inference.
    for key, entry in MESSAGES.items():
        text = entry["ar"]
        if "موضوع" in text or "مختلَق" in text:
            assert "لا يدل" in text or "لا تعني" in text, key


@pytest.mark.parametrize(
    ("query", "header", "expected"),
    [
        ("ar", "en", "ar"),
        ("en", "ar", "en"),
        ("AR-sa", None, "ar"),
        ("fr", "ar", "ar"),
        (None, "ar-EG", "ar"),
        (None, "en-US,en;q=0.9", "en"),
        (None, "en;q=0.4, ar-SA;q=0.9", "ar"),
        (None, "fr-FR, ar;q=0.2", "ar"),
        (None, "fr-FR, de;q=0.5", "en"),
        (None, "ar;q=0, en;q=0.1", "en"),
        (None, "*", "en"),
        (None, "ar;q=abc", "en"),
        (None, "", "en"),
        (None, None, "en"),
    ],
)
def test_locale_negotiation_order(
    monkeypatch: pytest.MonkeyPatch, query: str | None, header: str | None, expected: str
) -> None:
    monkeypatch.delenv("ISNAD_DEFAULT_LOCALE", raising=False)

    assert negotiate_locale(query, header) == expected


def test_default_locale_comes_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ISNAD_DEFAULT_LOCALE", "ar")
    assert negotiate_locale(None, None) == "ar"
    assert negotiate_locale(None, "fr") == "ar"
    assert negotiate_locale("en", None) == "en"
    assert negotiate_locale(None, "en") == "en"

    monkeypatch.setenv("ISNAD_DEFAULT_LOCALE", "klingon")
    assert negotiate_locale(None, None) == "en"


def test_normalize_and_parse_helpers() -> None:
    assert normalize_locale("en_GB") == "en"
    assert normalize_locale("  ar ") == "ar"
    assert normalize_locale("arn") is None
    assert parse_accept_language("ar-SA;q=0.8, en;q=0.8") == "ar"


def test_render_falls_back_to_english_and_localizes_term_parameters() -> None:
    assert render("quran.full_match", "fr", edition="tanzil_uthmani") == render(
        "quran.full_match", "en", edition="tanzil_uthmani"
    )
    assert "Tanzil Uthmani" in render("quran.full_match", "en", edition="tanzil_uthmani")
    assert "مشروع تنزيل" in render("quran.full_match", "ar", edition="tanzil_uthmani")
    # An edition without a catalog term is rendered literally in every locale.
    assert "Custom edition" in render("quran.full_match", "ar", edition="Custom edition")
    with pytest.raises(KeyError):
        render("no.such.key", "en")
    with pytest.raises(KeyError):
        Message.of("no.such.key")


def test_english_explanations_are_byte_identical_to_the_contract() -> None:
    engine_result = VerificationEngine((QuranArabicVerifier(),)).verify(
        VerificationInput(source="tafsir", language="en", quote="x")
    )
    assert engine_result.explanation == (
        "No verifier is configured for this source and language. "
        "This is not a finding that the citation is false."
    )
    assert engine_result.explanation_key == "engine.unsupported_source_or_language"

    verifier = QuranArabicVerifier()
    not_found = verifier.verify(
        VerificationInput(source="quran", language="ar", quote="كلمات غير موجودة إطلاقا هنا")
    )
    assert not_found.explanation == (
        "The quote was not located in the checked Tanzil Uthmani corpus. "
        "This result is limited to that source and does not establish that the "
        "wording is fabricated or absent from every source."
    )
    assert not_found.explanation_key == "quran.not_found_in_checked_corpus"
    assert not_found.render_explanation("en") == not_found.explanation
    assert "مشروع تنزيل" in not_found.render_explanation("ar")

    unsupported = verifier.verify(VerificationInput(source="quran", language="en", quote="x"))
    assert unsupported.explanation == (
        "This verifier checks ar Qur'an quotations against the pinned Tanzil Uthmani edition only."
    )
    assert "باللغة العربية" in unsupported.render_explanation("ar")


def test_results_without_a_catalog_key_keep_their_explanation() -> None:
    result = VerificationResult(
        status=MatchStatus.EXACT_MATCH,
        source_type="quran",
        language="en",
        source_metadata=None,
        submitted_quote="q",
        cited_reference=None,
        matched_references=(),
        evidence=(),
        wording_differences=(),
        explanation="Custom adapter text.",
    )

    assert result.explanation_key is None
    assert result.render_explanation("ar") == "Custom adapter text."
