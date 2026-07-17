"""Smoke tests for the research worker health contract."""

from black_book_research import health


def test_health() -> None:
    assert health()["service"] == "research"
