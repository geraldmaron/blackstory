"""Unit-only abuse coverage for URL policy and the isolated fetch state machine."""

from __future__ import annotations

import pytest

from .policy import UrlPolicyError, is_public_ip, parse_external_url, pin_destination
from .worker import (
    FetchLimits,
    TransportRequest,
    TransportResponse,
    evaluate_job,
)


PUBLIC_IP = "93.184.216.34"


def resolve_public(_hostname: str) -> tuple[str, ...]:
    return (PUBLIC_IP,)


def successful_transport(_request: TransportRequest) -> TransportResponse:
    return TransportResponse(
        status=200,
        headers={"content-type": "text/plain"},
        remote_address=PUBLIC_IP,
        body=b"public evidence",
    )


@pytest.mark.parametrize(
    "address",
    [
        "0.0.0.0",
        "10.0.0.1",
        "127.0.0.1",
        "169.254.169.254",
        "172.16.0.1",
        "192.168.0.1",
        "224.0.0.1",
        "::",
        "::1",
        "fc00::1",
        "fe80::1",
        "ff02::1",
        "2001:db8::1",
        "::ffff:127.0.0.1",
    ],
)
def test_rejects_non_public_ipv4_and_ipv6(address: str) -> None:
    assert not is_public_ip(address)


@pytest.mark.parametrize(
    ("url", "reason"),
    [
        ("file:///etc/passwd", "scheme_not_allowed"),
        ("gopher://example.org", "scheme_not_allowed"),
        ("https://user:secret@example.org", "userinfo_not_allowed"),
        ("https://example.org:22", "port_not_allowed"),
        ("http://metadata.google.internal/", "domain_not_allowed"),
    ],
)
def test_rejects_alternate_schemes_userinfo_ports_and_metadata(
    url: str,
    reason: str,
) -> None:
    with pytest.raises(UrlPolicyError, match=reason):
        parse_external_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://2130706433/",
        "http://0x7f000001/",
        "http://0177.0.0.1/",
        "http://127.1/",
    ],
)
def test_decodes_and_blocks_encoded_loopback_addresses(url: str) -> None:
    parsed = parse_external_url(url)
    with pytest.raises(UrlPolicyError, match="dns_answer_not_public"):
        pin_destination(parsed, ())


def test_rejects_dns_rebinding_answers_and_connected_address_mismatch() -> None:
    mixed = evaluate_job(
        "https://example.org",
        resolve=lambda _hostname: (PUBLIC_IP, "127.0.0.1"),
        transport=successful_transport,
    )
    assert mixed.reason == "dns_answer_not_public"

    rebound = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=lambda _request: TransportResponse(
            status=200,
            headers={"content-type": "text/plain"},
            remote_address="10.0.0.1",
            body=b"internal",
        ),
    )
    assert rebound.reason == "connected_address_mismatch"


def test_redirect_to_cloud_metadata_is_revalidated() -> None:
    result = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=lambda _request: TransportResponse(
            status=302,
            headers={"location": "http://169.254.169.254/latest/meta-data/"},
            remote_address=PUBLIC_IP,
            body=b"",
        ),
    )
    assert result.reason == "dns_answer_not_public"


def test_redirect_limit_is_enforced() -> None:
    result = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=lambda _request: TransportResponse(
            status=302,
            headers={"location": "/again"},
            remote_address=PUBLIC_IP,
            body=b"",
        ),
        limits=FetchLimits(max_redirects=1),
    )
    assert result.reason == "redirect_limit_exceeded"


def test_worker_enforces_source_domain_policy() -> None:
    result = evaluate_job(
        "https://other.example",
        resolve=resolve_public,
        transport=successful_transport,
        allowed_domains=("approved.example",),
    )
    assert result.reason == "domain_not_allowed"


def test_oversized_and_slow_responses_are_rejected() -> None:
    oversized = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=lambda _request: TransportResponse(
            status=200,
            headers={"content-type": "text/plain"},
            remote_address=PUBLIC_IP,
            body=b"x" * 11,
        ),
        limits=FetchLimits(max_response_bytes=10),
    )
    assert oversized.reason == "response_too_large"

    ticks = iter((0.0, 0.0, 0.0, 2.0))
    slow = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=successful_transport,
        limits=FetchLimits(max_duration_seconds=1),
        clock=lambda: next(ticks),
    )
    assert slow.reason == "duration_exceeded"


def test_safe_content_is_hashed_and_remains_non_publishable() -> None:
    result = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=successful_transport,
    )
    assert result.state == "validated"
    assert result.content_hash is not None
    assert len(result.content_hash) == 64
    assert result.publication_allowed is False


def test_malware_indicator_keeps_content_rejected() -> None:
    result = evaluate_job(
        "https://example.org",
        resolve=resolve_public,
        transport=lambda _request: TransportResponse(
            status=200,
            headers={"content-type": "text/html"},
            remote_address=PUBLIC_IP,
            body=b"<script>unsafe()</script>",
        ),
    )
    assert result.state == "rejected"
    assert result.reason == "malware_indicator"
    assert result.malware_indicators == ("active_content",)
