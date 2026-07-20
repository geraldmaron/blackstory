from __future__ import annotations

from .trafilatura_extract import extract_page

FIXTURE_HTML = """
<html>
<head><title>Fallback Title</title></head>
<body>
<nav>Home | About | Contact</nav>
<header>Site Header</header>
<article>
<h1>Rosenwald School Historic Site</h1>
<p>This school was built in 1922 as part of the Rosenwald Fund program,
which partnered with Black communities across the segregated South to
construct thousands of schools between 1912 and 1937.</p>
<p>The building is listed on the National Register of Historic Places.</p>
</article>
<footer>Copyright 2026</footer>
</body>
</html>
"""


def test_extract_page_drops_nav_and_footer_keeps_article_text() -> None:
    result = extract_page(FIXTURE_HTML, url="https://example.gov/rosenwald-school")
    assert "Rosenwald Fund program" in result["text"]
    assert "National Register of Historic Places" in result["text"]
    assert "Home | About | Contact" not in result["text"]
    assert "Copyright 2026" not in result["text"]


def test_extract_page_handles_empty_html() -> None:
    result = extract_page("<html><body></body></html>")
    assert result["text"] == ""
