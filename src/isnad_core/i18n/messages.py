"""Message catalog: every human-readable API string, in English and Arabic.

Editing rules:
- English text is the API contract's default and must stay byte-identical to what
  clients already receive; change it only together with the contract.
- Both locales use the same ``{placeholder}`` names.
- A status is textual correspondence only. No text may present a match status as
  an authenticity grade or a religious ruling, and a missing result is never
  described as fabricated (موضوع / مختلَق) - only as not located in the checked
  source.
- Arabic is Modern Standard Arabic. Source names and identifiers that a reader
  must match against the source itself (``HadeethEnc``, ``hadeethenc:<id>``,
  environment variable names) stay in Latin script.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType

# Parameters whose values are catalog identifiers (``term.<name>.<value>``) rather
# than literal text, so that an edition or language name is itself localized.
# Unknown values are rendered literally.
_TERM_PARAMS = frozenset({"edition", "language"})

_MESSAGES: dict[str, dict[str, str]] = {
    # -- Terms interpolated into other messages ---------------------------------
    "term.edition.tanzil_uthmani": {
        "en": "Tanzil Uthmani",
        "ar": "مشروع تنزيل — الرسم العثماني",
    },
    "term.edition.quranenc_english_saheeh": {
        "en": "QuranEnc English Saheeh translation",
        "ar": "موسوعة القرآن الكريم المترجمة — الترجمة الإنجليزية (صحيح)",
    },
    # The English rendering keeps the bare language code the contract has always used.
    "term.language.ar": {"en": "ar", "ar": "العربية"},
    "term.language.en": {"en": "en", "ar": "الإنجليزية"},
    # -- Engine -----------------------------------------------------------------
    "engine.unsupported_source_or_language": {
        "en": (
            "No verifier is configured for this source and language. "
            "This is not a finding that the citation is false."
        ),
        "ar": "لا يتوفر مُحقِّق مُهيَّأ لهذا المصدر وهذه اللغة. وهذا لا يعني أن الاستشهاد غير صحيح.",
    },
    # -- Qur'an verifier --------------------------------------------------------
    "quran.unsupported_source_or_language": {
        "en": (
            "This verifier checks {language} Qur'an quotations against "
            "the pinned {edition} edition only."
        ),
        "ar": (
            "يفحص هذا المُحقِّق الاقتباسات القرآنية باللغة {language} في نسخة «{edition}» المثبَّتة فقط."
        ),
    },
    "quran.cited_match": {
        "en": "The quote matches the cited {edition} text. This is a textual comparison only.",
        "ar": "يطابق الاقتباسُ نصَّ «{edition}» في الموضع المذكور. هذه مقارنة نصية فقط.",
    },
    "quran.cited_partial_match": {
        "en": (
            "The quote is a contiguous fragment of the cited {edition} text. "
            "The full source ayah text is included as evidence."
        ),
        "ar": (
            "الاقتباس جزء متصل من نص «{edition}» في الموضع المذكور، "
            "وقد أُرفق نص الآية كاملًا من المصدر شاهدًا."
        ),
    },
    "quran.cited_ambiguous": {
        "en": (
            "The wording occurs more than once within the cited range; the exact "
            "occurrence is ambiguous."
        ),
        "ar": (
            "يتكرر هذا اللفظ أكثر من مرة داخل النطاق المذكور، فيتعذّر تحديد الموضع المقصود بعينه."
        ),
    },
    "quran.quote_found_wrong_reference": {
        "en": "The quote was located in the pinned corpus, but not at the cited reference.",
        "ar": "عُثر على الاقتباس في المصدر المثبَّت، ولكن في غير الموضع المذكور.",
    },
    "quran.full_match": {
        "en": (
            "The quote matches a complete ayah or range in the pinned "
            "{edition} corpus. This is a textual comparison only."
        ),
        "ar": (
            "يطابق الاقتباسُ آيةً كاملة أو مقطعًا متصلًا من الآيات في نسخة «{edition}» "
            "المثبَّتة. هذه مقارنة نصية فقط."
        ),
    },
    "quran.partial_match": {
        "en": (
            "The quote is a contiguous fragment found in the pinned "
            "{edition} corpus. The full source ayah text "
            "is included as evidence."
        ),
        "ar": (
            "الاقتباس جزء متصل عُثر عليه في نسخة «{edition}» المثبَّتة، "
            "وقد أُرفق نص الآية كاملًا من المصدر شاهدًا."
        ),
    },
    "quran.ambiguous_multiple_matches": {
        "en": (
            "The wording has multiple locations in the checked corpus; a unique "
            "reference cannot be established from this quote alone."
        ),
        "ar": (
            "يرد هذا اللفظ في أكثر من موضع في المصدر المفحوص، "
            "فلا يمكن تعيين موضع واحد من الاقتباس وحده."
        ),
    },
    "quran.mismatch_at_cited_reference": {
        "en": (
            "The reference exists in the pinned corpus, but the quote does not "
            "match that text and was not located elsewhere in the checked corpus."
        ),
        "ar": (
            "الموضع المذكور موجود في المصدر المثبَّت، لكن الاقتباس لا يطابق نصه، "
            "ولم يُعثر عليه في موضع آخر من المصدر المفحوص."
        ),
    },
    "quran.not_found_in_checked_corpus": {
        "en": (
            "The quote was not located in the checked {edition} corpus. "
            "This result is limited to that source and does not establish that the "
            "wording is fabricated or absent from every source."
        ),
        "ar": (
            "لم يُعثر على الاقتباس في نسخة «{edition}» المفحوصة. "
            "وهذه النتيجة مقصورة على هذا المصدر، ولا تعني أن اللفظ مختلَق "
            "أو أنه غير موجود في أي مصدر آخر."
        ),
    },
    "quran.reference_found_without_quote": {
        "en": (
            "The reference exists in the pinned {edition} corpus, but no quote "
            "was supplied for comparison."
        ),
        "ar": "الموضع المذكور موجود في نسخة «{edition}» المثبَّتة، لكن لم يُرسَل اقتباس لمقارنته.",
    },
    # -- HadeethEnc verifier ----------------------------------------------------
    "hadith.unsupported_source_or_language": {
        "en": (
            "This adapter checks {language} hadith text in the curated "
            "HadeethEnc.com selection only."
        ),
        "ar": (
            "يفحص هذا المُحقِّق نصوص الأحاديث باللغة {language} "
            "في المختارات المنتقاة من موقع HadeethEnc.com فقط."
        ),
    },
    "hadith.reference_found_without_quote": {
        "en": (
            "The HadeethEnc record was located. Its supplied grade and attribution "
            "are shown separately and are not a ruling by this verifier."
        ),
        "ar": (
            "عُثر على سجل HadeethEnc المذكور. تُعرض درجته وتخريجه كما وردا في المصدر "
            "منفصلَين، وليسا حكمًا صادرًا عن هذا المُحقِّق."
        ),
    },
    "hadith.cited_match": {
        "en": (
            "The quote matches text in the cited HadeethEnc record. "
            "This textual comparison does not establish authenticity "
            "or a religious ruling."
        ),
        "ar": (
            "يطابق الاقتباسُ نصًّا في سجل HadeethEnc المذكور. "
            "وهذه المقارنة النصية لا تُثبت صحة الحديث، وليست حكمًا شرعيًّا."
        ),
    },
    "hadith.cited_ambiguous": {
        "en": "The quote occurs more than once in the cited HadeethEnc record.",
        "ar": "يتكرر الاقتباس أكثر من مرة في سجل HadeethEnc المذكور.",
    },
    "hadith.quote_found_wrong_reference": {
        "en": (
            "The quote was located in a different HadeethEnc record than the "
            "cited record ID. This is a locator mismatch, not a hadith grade."
        ),
        "ar": (
            "عُثر على الاقتباس في سجل HadeethEnc غير السجل المذكور رقمه. "
            "وهذا اختلاف في الموضع، وليس حكمًا على درجة الحديث."
        ),
    },
    "hadith.ambiguous_multiple_matches": {
        "en": (
            "The wording has multiple or truncated candidate locations in the "
            "checked HadeethEnc source; a unique record cannot be established."
        ),
        "ar": (
            "لهذا اللفظ مواضع مرشَّحة متعددة أو غير مكتملة في مصدر HadeethEnc المفحوص، "
            "فلا يمكن تعيين سجل واحد."
        ),
    },
    "hadith.mismatch_at_cited_reference": {
        "en": (
            "The HadeethEnc record exists, but the quote does not match its text. "
            "No conclusion about the report's authenticity is made."
        ),
        "ar": (
            "سجل HadeethEnc المذكور موجود، لكن الاقتباس لا يطابق نصه. "
            "ولا يُستنتج من ذلك شيء عن صحة الحديث."
        ),
    },
    "hadith.match": {
        "en": (
            "The quote was located in the checked HadeethEnc.com {language} "
            "selection. This textual comparison does not establish authenticity "
            "or a religious ruling."
        ),
        "ar": (
            "عُثر على الاقتباس في مختارات HadeethEnc.com المفحوصة باللغة {language}. "
            "وهذه المقارنة النصية لا تُثبت صحة الحديث، وليست حكمًا شرعيًّا."
        ),
    },
    "hadith.record_not_found": {
        "en": (
            "The cited HadeethEnc record ID was not located. This source is a curated "
            "selection; no conclusion about the report's authenticity is made."
        ),
        "ar": (
            "لم يُعثر على رقم سجل HadeethEnc المذكور. وهذا المصدر مختارات منتقاة، "
            "ولا يُستنتج من ذلك شيء عن صحة الحديث."
        ),
    },
    "hadith.record_not_found_search_truncated": {
        "en": (
            "The cited HadeethEnc record ID was not located. This source is a curated "
            "selection; no conclusion about the report's authenticity is made."
            " The separate quote search was truncated, so its other candidate "
            "locations are incomplete."
        ),
        "ar": (
            "لم يُعثر على رقم سجل HadeethEnc المذكور. وهذا المصدر مختارات منتقاة، "
            "ولا يُستنتج من ذلك شيء عن صحة الحديث. "
            "وقد اقتُطعت نتائج البحث المستقل عن الاقتباس، فالمواضع المرشَّحة الأخرى "
            "غير مكتملة."
        ),
    },
    "hadith.not_found_search_truncated": {
        "en": (
            "The wording was not located among the candidate records returned by a "
            "truncated HadeethEnc search. The checked selection is curated and "
            "non-comprehensive; this does not establish that the report is fabricated "
            "or mawḍūʿ."
        ),
        "ar": (
            "لم يُعثر على اللفظ بين السجلات المرشَّحة التي أعادها بحث HadeethEnc، "
            "وقد اقتُطعت نتائج هذا البحث. والمختارات المفحوصة منتقاة وغير شاملة، "
            "فلا يدل ذلك على أن الحديث موضوع أو مختلَق."
        ),
    },
    "hadith.not_found_in_checked_corpus": {
        "en": (
            "The wording was not located in the checked HadeethEnc selection. "
            "HadeethEnc is curated and non-comprehensive; this does not establish "
            "that the report is fabricated or mawḍūʿ."
        ),
        "ar": (
            "لم يُعثر على اللفظ في مختارات HadeethEnc المفحوصة. "
            "وهذه المختارات منتقاة وغير شاملة، فلا يدل ذلك على أن الحديث موضوع أو مختلَق."
        ),
    },
    # -- Source metadata --------------------------------------------------------
    "source.tanzil-quran-uthmani.display_name": {
        "en": "Tanzil Project — Uthmani script",
        "ar": "مشروع تنزيل — الرسم العثماني",
    },
    "source.quranenc-english-saheeh.display_name": {
        "en": "QuranEnc — English translation (Saheeh)",
        "ar": "موسوعة القرآن الكريم المترجمة — الترجمة الإنجليزية (صحيح)",
    },
    "source.hadeethenc-api-v1.display_name": {
        "en": "HadeethEnc — Encyclopedia of Prophetic Hadiths",
        "ar": "موسوعة الأحاديث النبوية",
    },
    "source.hadeethenc-api-v1.coverage_note": {
        "en": (
            "Curated selection, not a comprehensive hadith corpus. A missing result "
            "means only that the checked HadeethEnc source did not locate it."
        ),
        "ar": (
            "مختارات منتقاة، وليست مجموعة شاملة للأحاديث. "
            "وغياب النتيجة يعني فقط أن مصدر HadeethEnc المفحوص لم يتضمنها."
        ),
    },
    # -- Status vocabulary (labels and meanings, as the interface shows them) ---
    "status.exact_match.label": {"en": "Exact match", "ar": "مطابقة تامة"},
    "status.exact_match.meaning": {
        "en": "The submitted text matches the source wording at the cited reference.",
        "ar": "النص المُدخل يطابق نص المصدر في الموضع المذكور حرفًا بحرف.",
    },
    "status.normalized_match.label": {
        "en": "Match after normalization",
        "ar": "مطابقة بعد توحيد الرسم",
    },
    "status.normalized_match.meaning": {
        "en": (
            "The text matches the source once non-lexical differences such as diacritics "
            "and tatweel are set aside by the source’s normalization profile."
        ),
        "ar": "يطابق النصَّ بعد تجاوز الفروق غير اللفظية كالتشكيل والتطويل.",
    },
    "status.partial_match.label": {"en": "Partial match", "ar": "مطابقة جزئية"},
    "status.partial_match.meaning": {
        "en": (
            "Only part of the submitted text corresponds to the source. "
            "The quote is not fully supported as submitted."
        ),
        "ar": "جزء من النص فقط يوافق المصدر.",
    },
    "status.mismatch_at_cited_reference.label": {
        "en": "Mismatch at the cited reference",
        "ar": "لا يطابق الموضع المذكور",
    },
    "status.mismatch_at_cited_reference.meaning": {
        "en": "The cited reference does not contain the submitted wording.",
        "ar": "الموضع موجود، لكنه لا يتضمن النص المُدخل.",
    },
    "status.quote_found_wrong_reference.label": {
        "en": "Quote found at a different reference",
        "ar": "النص في موضع آخر",
    },
    "status.quote_found_wrong_reference.meaning": {
        "en": "The wording was located in the source, but not at the reference that was cited.",
        "ar": "النص موجود في المصدر، لكن في موضع غير المذكور.",
    },
    "status.reference_found_without_quote.label": {
        "en": "Reference found, no quote compared",
        "ar": "موضع بلا نص للمقارنة",
    },
    "status.reference_found_without_quote.meaning": {
        "en": (
            "The reference exists in the checked source. No quoted text was submitted, "
            "so no wording was compared."
        ),
        "ar": "الموضع موجود، ولم يُرسَل نص لمقارنته.",
    },
    "status.not_found_in_checked_corpus.label": {
        "en": "Not found in the checked corpus",
        "ar": "غير موجود في المصدر المفحوص",
    },
    "status.not_found_in_checked_corpus.meaning": {
        "en": (
            "The bounded source that was searched does not contain this wording. "
            "This says nothing about sources outside that corpus, and nothing about "
            "whether the report is authentic or fabricated."
        ),
        "ar": "لم يُعثر على النص في الإصدار المحدود الذي فُحص.",
    },
    "status.ambiguous_multiple_matches.label": {
        "en": "Ambiguous — multiple matches",
        "ar": "مطابقات متعددة",
    },
    "status.ambiguous_multiple_matches.meaning": {
        "en": (
            "More than one location in the source matched. "
            "The result cannot be reduced to a single reference."
        ),
        "ar": "طابق النصُّ أكثر من موضع، فتعذّر حصره في موضع واحد.",
    },
    "status.unsupported_source_or_language.label": {
        "en": "Source or language not supported",
        "ar": "المصدر أو اللغة غير مدعومة",
    },
    "status.unsupported_source_or_language.meaning": {
        "en": "No adapter is configured for this source and language pair.",
        "ar": "لا يتوفر مُحقِّق لهذا المصدر وهذه اللغة.",
    },
    # -- Capabilities -----------------------------------------------------------
    "capabilities.streaming_policy": {
        "en": (
            "Prose outside marked citation blocks streams immediately; quote and reference "
            "stay hidden until verification completes. Literal marker text inside a quote "
            "must be backslash-escaped. Malformed or incomplete blocks are rejected without "
            "quote text."
        ),
        "ar": (
            "يُبَثّ النص الواقع خارج كتل الاستشهاد المعلَّمة فورًا، ويبقى الاقتباس والموضع "
            "محجوبَين حتى يكتمل التحقق. ويجب أن يُسبَق نص العلامة الحرفي داخل الاقتباس "
            "بشرطة مائلة عكسية. وتُرفض الكتل المشوَّهة أو غير المكتملة دون إظهار نص الاقتباس."
        ),
    },
    # -- Errors (the ``code`` is the stable contract; only ``message`` varies) ---
    "error.invalid_request": {
        "en": "Request body did not match the API contract.",
        "ar": "جسم الطلب لا يطابق مواصفات الواجهة البرمجية.",
    },
    "error.invalid_quran_reference": {
        "en": "The reference is malformed or outside the pinned Qur'an corpus.",
        "ar": "صيغة الموضع غير صحيحة، أو أنه خارج نطاق نص القرآن المثبَّت.",
    },
    "error.invalid_hadith_reference": {
        "en": "Hadith references must use the HadeethEnc record form hadeethenc:<id>.",
        "ar": "يجب أن يُكتب موضع الحديث بصيغة سجل HadeethEnc، أي hadeethenc:<id>.",
    },
    "error.source_unavailable": {
        "en": "A checked source is temporarily unavailable; no not-found result was inferred.",
        "ar": "أحد المصادر المفحوصة غير متاح مؤقتًا، ولم يُستنتج من ذلك أن النص غير موجود.",
    },
    "error.invalid_citation": {
        "en": "The citation could not be compared; check the quote and reference fields.",
        "ar": "تعذّرت مقارنة الاستشهاد؛ راجع حقلَي النص والموضع.",
    },
    "error.not_found": {
        "en": "This endpoint is not enabled on this server.",
        "ar": "هذه الخدمة غير مفعَّلة على هذا الخادم.",
    },
    "error.request_too_large": {
        "en": "The request body limit is {max_body_bytes} bytes.",
        "ar": "الحد الأقصى لحجم جسم الطلب {max_body_bytes} بايت.",
    },
    "error.invalid_content_length": {
        "en": "The request content length is invalid.",
        "ar": "قيمة طول محتوى الطلب غير صالحة.",
    },
    "error.model_not_configured": {
        "en": "This server has no model key; set ISNAD_MODEL_API_KEY.",
        "ar": "لم يُضبط مفتاح للنموذج على هذا الخادم؛ عيِّن المتغير ISNAD_MODEL_API_KEY.",
    },
    "error.model_invalid_request": {
        "en": "Send an OpenAI-style chat request with a messages list.",
        "ar": "أرسل طلب محادثة بصيغة OpenAI يتضمن قائمة messages.",
    },
    "error.model_unreachable": {
        "en": "The model provider could not be reached.",
        "ar": "تعذّر الوصول إلى مزوِّد النموذج.",
    },
}

MESSAGES: MappingProxyType[str, MappingProxyType[str, str]] = MappingProxyType(
    {key: MappingProxyType(entry) for key, entry in _MESSAGES.items()}
)


def has_message(key: str) -> bool:
    """Return whether ``key`` is a catalog entry."""

    return key in MESSAGES


def _localized_param(name: str, value: str, locale: str) -> str:
    if name not in _TERM_PARAMS:
        return value
    term = MESSAGES.get(f"term.{name}.{value}")
    if term is None:
        return value
    return term.get(locale) or term["en"]


def render(key: str, locale: str = "en", /, **params: object) -> str:
    """Render catalog entry ``key`` in ``locale``, falling back to English.

    Raises ``KeyError`` for an unknown key: a missing entry is a programming error,
    not something to paper over with an untranslated string.
    """

    entry = MESSAGES[key]
    template = entry.get(locale) or entry["en"]
    values = {name: _localized_param(name, str(value), locale) for name, value in params.items()}
    return template.format(**values)


@dataclass(frozen=True, slots=True)
class Message:
    """A catalog key with its parameters, rendered only when a locale is known."""

    key: str
    params: tuple[tuple[str, str], ...] = ()

    @classmethod
    def of(cls, key: str, /, **params: object) -> Message:
        """Build a message, rejecting keys that are not in the catalog."""

        if key not in MESSAGES:
            raise KeyError(f"Unknown message key: {key}")
        return cls(key, tuple(sorted((name, str(value)) for name, value in params.items())))

    def render(self, locale: str = "en") -> str:
        """Render this message in ``locale``."""

        return render(self.key, locale, **dict(self.params))

    def result_fields(self) -> dict[str, object]:
        """Return the ``VerificationResult`` keyword arguments for this explanation."""

        return {
            "explanation": self.render("en"),
            "explanation_key": self.key,
            "explanation_params": self.params,
        }
