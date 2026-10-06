"""Build the single-file ISNAD verification UI.

The deliverables are one self-contained HTML file (for download and local use)
and a server template with the same markup, CSS and script, served by the API
itself with a restrictive Content-Security-Policy.

Everything is inlined on purpose: the interface must run from ``file://`` and
inside sandboxed previews that cannot fetch external stylesheets, scripts or
fonts. Nothing here reaches the network except the configured API base.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

# Kept identical to the policy the API sends as a header (isnad_core.api.app).
# frame-ancestors is deliberately absent: it is ignored in a meta element, and
# framing is a deployment decision made at the header layer.
APPLICATION_CSP = (
    "default-src 'none'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self' data:; "
    "connect-src *; "
    "form-action 'none'; "
    "base-uri 'none'"
)

# Inlined into the page head. Injected here rather than written into the
# template so the template stays valid, openable HTML.
CSP_META = '  <meta http-equiv="Content-Security-Policy" content="' + APPLICATION_CSP + '">'

STANDALONE_HEAD = (
    '  <meta name="isnad-build" content="standalone">\n'
    '  <meta name="isnad-note" content="Self-contained build: no external scripts, '
    'styles, fonts or images. External requests go only to the API base you configure.">'
)


# Subset WOFF2 files in frontend/fonts (see NOTICE.md), inlined as data: URIs
# so both builds stay single-file. The CSP above allows data: for fonts only.
FONT_FACES = (
    ("IBM Plex Sans Arabic", 400, "IBMPlexSansArabic-Regular.woff2"),
    ("IBM Plex Sans Arabic", 600, "IBMPlexSansArabic-SemiBold.woff2"),
    ("IBM Plex Mono", 400, "IBMPlexMono-Regular.woff2"),
    ("Amiri Quran", 400, "AmiriQuran-Regular.woff2"),
)

# Inlined in this order: later scripts use globals defined by earlier ones.
SCRIPTS = ("i18n.js", "geometry.js", "charts.js", "citation_stream.js", "app.js")


def read(name: str) -> str:
    return (FRONTEND / name).read_text(encoding="utf-8")


def font_faces() -> str:
    """Return @font-face rules with each font embedded as a base64 data URI."""

    rules = []
    for family, weight, filename in FONT_FACES:
        data = base64.b64encode((FRONTEND / "fonts" / filename).read_bytes()).decode("ascii")
        rules.append(
            "@font-face { font-family: '" + family + "'; font-style: normal; "
            f"font-weight: {weight}; font-display: swap; "
            f"src: url(data:font/woff2;base64,{data}) format('woff2'); }}\n"
        )
    return "".join(rules)


def render(*, standalone: bool) -> str:
    """Return the interface HTML for either build mode."""

    template = read("index.template.html")
    styles = font_faces() + read("theme.css")
    icons = read("icons.svg")

    head_extra = STANDALONE_HEAD if standalone else CSP_META
    parts = template.split("<!-- ISNAD_CSS -->")
    if len(parts) != 2:
        raise ValueError("template is missing the ISNAD_CSS placeholder")
    html = parts[0] + head_extra + "\n  <style>\n" + styles + "  </style>\n" + parts[1]

    parts = html.split("<!-- ISNAD_ICONS -->")
    if len(parts) != 2:
        raise ValueError("template is missing the ISNAD_ICONS placeholder")
    html = parts[0] + icons + parts[1]

    parts = html.split("<!-- ISNAD_APP -->")
    if len(parts) != 2:
        raise ValueError("template is missing the ISNAD_APP placeholder")
    script = "".join("  <script>\n" + read(name) + "\n  </script>\n" for name in SCRIPTS)
    return parts[0] + script + parts[1]


def main() -> int:
    """Write both builds and report their paths and sizes."""

    targets = (
        (FRONTEND / "isnad-gui.html", True),
        (ROOT / "src" / "isnad_core" / "api" / "templates" / "gui.html", False),
        (ROOT / "src" / "isnad_core" / "api" / "static" / "isnad-gui.html", True),
    )

    for path, standalone in targets:
        html = render(standalone=standalone)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        print(
            f"wrote {path.relative_to(ROOT)} ({len(html) // 1024} KiB, "
            f"{'standalone' if standalone else 'CSP meta'})"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
