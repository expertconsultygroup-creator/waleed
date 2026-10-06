"""Shared verification result types used by source adapters and product surfaces."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from isnad_core.i18n.messages import has_message, render


class MatchStatus(StrEnum):
    """Textual correspondence outcomes; these are not authenticity grades or rulings."""

    EXACT_MATCH = "exact_match"
    NORMALIZED_MATCH = "normalized_match"
    PARTIAL_MATCH = "partial_match"
    MISMATCH_AT_CITED_REFERENCE = "mismatch_at_cited_reference"
    QUOTE_FOUND_WRONG_REFERENCE = "quote_found_wrong_reference"
    REFERENCE_FOUND_WITHOUT_QUOTE = "reference_found_without_quote"
    NOT_FOUND_IN_CHECKED_CORPUS = "not_found_in_checked_corpus"
    AMBIGUOUS_MULTIPLE_MATCHES = "ambiguous_multiple_matches"
    UNSUPPORTED_SOURCE_OR_LANGUAGE = "unsupported_source_or_language"


@dataclass(frozen=True, slots=True)
class SourceMetadata:
    """Immutable provenance for the corpus that supplied displayed evidence."""

    source_id: str
    name: str
    url: str
    version: str
    license: str
    content_sha256: str | None = None
    coverage_note: str | None = None


@dataclass(frozen=True, slots=True)
class WordingDifference:
    """A word-level difference between the submitted wording and source wording."""

    kind: str
    submitted_text: str
    source_text: str


@dataclass(frozen=True, slots=True)
class Evidence:
    """Source-backed text and locator supporting a verification result."""

    reference: str
    source_text: str
    matched_fragment: str | None
    source_id: str
    source_version: str
    source_url: str
    footnotes: str | None = None
    record_title: str | None = None
    attribution_text: str | None = None
    grade_text: str | None = None
    grade_source: str | None = None
    graded_by: str | None = None
    bibliographic_reference: str | None = None


@dataclass(frozen=True, slots=True)
class VerificationInput:
    """A citation candidate passed to the shared verifier."""

    source: str
    language: str
    quote: str | None
    reference: str | None = None


@dataclass(frozen=True, slots=True)
class VerificationResult:
    """Auditable textual verification result for a single citation candidate."""

    status: MatchStatus
    source_type: str
    language: str
    source_metadata: SourceMetadata | None
    submitted_quote: str | None
    cited_reference: str | None
    matched_references: tuple[str, ...]
    evidence: tuple[Evidence, ...]
    wording_differences: tuple[WordingDifference, ...]
    explanation: str
    candidate_count: int | None = 0
    evidence_truncated: bool = False
    # ``explanation`` is the English rendering, kept for existing callers. The key and
    # parameters let a transport render the same explanation in another locale.
    explanation_key: str | None = None
    explanation_params: tuple[tuple[str, str], ...] = ()

    def render_explanation(self, locale: str = "en") -> str:
        """Return the explanation in ``locale``; results without a catalog key stay as-is."""

        if locale == "en" or self.explanation_key is None or not has_message(self.explanation_key):
            return self.explanation
        return render(self.explanation_key, locale, **dict(self.explanation_params))

    @property
    def is_textually_matched(self) -> bool:
        """Return whether the result establishes textual correspondence only."""

        return self.status in {
            MatchStatus.EXACT_MATCH,
            MatchStatus.NORMALIZED_MATCH,
            MatchStatus.PARTIAL_MATCH,
        }
