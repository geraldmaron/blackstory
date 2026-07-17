"""Smoke tests for the security worker health contract."""

from black_book_security import health


def test_health() -> None:
    assert health()["service"] == "security"
