"""Locale negotiation and the message catalog for human-readable API text.

Only human-readable strings are localized. Machine-readable values (`status`,
error `code`, references, source identifiers) are identical in every locale, so
a client may switch language without changing how it interprets a result.
"""

from __future__ import annotations

import os
from typing import Literal

from isnad_core.i18n.messages import MESSAGES, Message, has_message, render

Locale = Literal["ar", "en"]

SUPPORTED_LOCALES: tuple[Locale, ...] = ("ar", "en")
FALLBACK_LOCALE: Locale = "en"
DEFAULT_LOCALE_ENV = "ISNAD_DEFAULT_LOCALE"

__all__ = [
    "DEFAULT_LOCALE_ENV",
    "FALLBACK_LOCALE",
    "MESSAGES",
    "SUPPORTED_LOCALES",
    "Locale",
    "Message",
    "default_locale",
    "has_message",
    "negotiate_locale",
    "normalize_locale",
    "parse_accept_language",
    "render",
]


def normalize_locale(value: str | None) -> Locale | None:
    """Map a language tag such as ``ar-SA`` or ``EN_us`` to a supported locale, if any."""

    if value is None:
        return None
    primary = value.strip().replace("_", "-").split("-", 1)[0].casefold()
    if primary == "ar":
        return "ar"
    if primary == "en":
        return "en"
    return None


def parse_accept_language(header: str | None) -> Locale | None:
    """Return the supported locale with the highest ``q`` weight in an Accept-Language value.

    Entries with ``q=0`` or an unparseable weight are ignored, ties keep header order,
    and the ``*`` wildcard never selects a locale (the configured default applies).
    """

    if not header:
        return None
    weighted: list[tuple[float, int, Locale]] = []
    for position, entry in enumerate(header.split(",")):
        parts = [part.strip() for part in entry.split(";")]
        tag = parts[0]
        if not tag or tag == "*":
            continue
        weight = 1.0
        for parameter in parts[1:]:
            name, _, raw_value = parameter.partition("=")
            if name.strip().casefold() != "q":
                continue
            try:
                weight = float(raw_value.strip())
            except ValueError:
                weight = 0.0
        if not 0.0 < weight <= 1.0:
            continue
        locale = normalize_locale(tag)
        if locale is not None:
            weighted.append((-weight, position, locale))
    if not weighted:
        return None
    return min(weighted)[2]


def default_locale() -> Locale:
    """Return the deployment default from ``ISNAD_DEFAULT_LOCALE``, else English."""

    return normalize_locale(os.environ.get(DEFAULT_LOCALE_ENV)) or FALLBACK_LOCALE


def negotiate_locale(
    query_lang: str | None = None,
    accept_language: str | None = None,
) -> Locale:
    """Pick the response locale: ``?lang=``, then Accept-Language, then the default.

    An unsupported ``lang`` value is ignored rather than rejected, so a client
    asking for a language this service does not have still gets an answer.
    """

    return (
        normalize_locale(query_lang) or parse_accept_language(accept_language) or default_locale()
    )
