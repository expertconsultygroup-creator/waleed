"""The Next.js interface (web/) as the API serves it.

web/ is the source; src/isnad_core/api/web/ is its committed static export,
written by `npm run export`. These tests cover how that export is served and
the invariants it shares with the classic interface.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from isnad_core.api.app import create_app

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / "src" / "isnad_core" / "api" / "web"
WEB = ROOT / "web"

pytestmark = pytest.mark.skipif(
    not (EXPORT / "index.html").is_file(), reason="the web interface has not been exported"
)


def _client() -> TestClient:
    return TestClient(create_app())


def test_root_serves_the_web_interface_with_the_interface_policy() -> None:
    with _client() as client:
        root = client.get("/")
        alias = client.get("/gui")
        head = client.head("/")

    assert root.status_code == 200
    assert root.text == (EXPORT / "index.html").read_text(encoding="utf-8")
    assert alias.text == root.text
    # Next.js checks pages with HEAD before moving to them.
    assert head.status_code == 200
    policy = root.headers["content-security-policy"]
    assert "default-src 'none'" in policy
    assert "font-src 'self' data:" in policy
    assert "https://" not in policy


def test_web_interface_is_arabic_first_and_fetches_nothing_external() -> None:
    html = (EXPORT / "index.html").read_text(encoding="utf-8")

    assert re.search(r'<html[^>]*lang="ar"[^>]*dir="rtl"', html)
    # Fonts are built into the export; nothing loads from a third party.
    assert "fonts.googleapis.com" not in html
    assert "fonts.gstatic.com" not in html
    assert not re.search(r'<script[^>]+src="https?://', html)
    assert not re.search(r'<link[^>]+href="https?://', html)


def test_dashboard_page_and_navigation_payloads_are_served() -> None:
    with _client() as client:
        page = client.get("/dashboard/")
        bare = client.get("/dashboard")
        payload = client.get("/dashboard/index.txt")

    assert page.status_code == 200
    assert "content-security-policy" in page.headers
    assert bare.status_code == 200
    assert payload.status_code == 200


def test_build_assets_are_cached_and_pages_are_not() -> None:
    html = (EXPORT / "index.html").read_text(encoding="utf-8")
    asset = re.search(r'"(/_next/static/[^"]+\.js)"', html)
    assert asset, "the export references no script assets"

    with _client() as client:
        script = client.get(asset.group(1))
        page = client.get("/")

    assert script.status_code == 200
    assert "immutable" in script.headers["cache-control"]
    assert page.headers["cache-control"] == "no-store"


def test_classic_interface_stays_available() -> None:
    template = ROOT / "src" / "isnad_core" / "api" / "templates" / "gui.html"
    with _client() as client:
        classic = client.get("/classic")
        download = client.get("/gui/standalone.html")

    assert classic.status_code == 200
    assert classic.text == template.read_text(encoding="utf-8")
    assert download.headers["content-disposition"].startswith("attachment")


def test_unknown_paths_keep_the_api_error_envelope_and_never_leave_the_export() -> None:
    with _client() as client:
        api = client.get("/v1/does-not-exist")
        page = client.get("/no-such-page")
        escape = client.get("/..%2F..%2Fpyproject.toml")
        escape_dir = client.get("/_next/..%2F..%2Fapp.py")

    assert api.status_code == 404
    assert api.json()["error"]["code"] == "not_found"
    assert page.status_code == 404
    for response in (escape, escape_dir):
        assert response.status_code == 404
        assert "[project]" not in response.text
        assert "create_app" not in response.text


def test_both_interfaces_gate_quotations_with_the_same_streamer() -> None:
    shared = (ROOT / "frontend" / "citation_stream.js").read_text(encoding="utf-8")
    copy = (WEB / "src" / "lib" / "citation-stream.js").read_text(encoding="utf-8")
    assert copy == shared, "run `npm run sync` in web/"


def test_web_catalog_has_every_key_in_both_languages() -> None:
    source = (WEB / "src" / "lib" / "i18n" / "messages.ts").read_text(encoding="utf-8")
    ar_block, en_block = source.split("export const en: Catalog = ", 1)
    key = re.compile(r'^  "([\w.]+)":', re.MULTILINE)
    ar_keys = set(key.findall(ar_block))
    en_keys = set(key.findall(en_block))
    assert ar_keys and ar_keys == en_keys
    # The disclaimers are present in Arabic as well as English.
    assert "ليست حكمًا على صحة الحديث ولا فتوى شرعية" in ar_block
    assert "not a hadith authenticity grade or religious ruling" in en_block
