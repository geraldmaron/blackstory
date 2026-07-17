"""Smoke tests for the publication worker health contract."""

from black_book_publication import health


def test_health() -> None:
    assert health()["service"] == "publication"
