"""Pure URL and destination policy for the egress-restricted fetch worker."""

from __future__ import annotations

from dataclasses import dataclass
import ipaddress
from urllib.parse import SplitResult, urlsplit, urlunsplit


METADATA_HOSTS = frozenset(
    {
        "metadata",
        "metadata.google.internal",
        "metadata.goog",
        "instance-data",
        "instance-data.ec2.internal",
    }
)


class UrlPolicyError(ValueError):
    """Raised when an external URL fails the worker's fail-closed policy."""


@dataclass(frozen=True)
class ParsedUrl:
    """Normalized network destination approved for DNS evaluation."""

    normalized_url: str
    hostname: str
    port: int
    scheme: str


@dataclass(frozen=True)
class PinnedDestination:
    """A public destination whose exact connect address is pinned."""

    url: ParsedUrl
    pinned_address: str
    approved_addresses: tuple[str, ...]


def _legacy_ipv4(hostname: str) -> ipaddress.IPv4Address | None:
    """Decode WHATWG-compatible integer, hex, octal, and shortened IPv4 forms."""
    parts = hostname.lower().split(".")
    if not 1 <= len(parts) <= 4:
        return None
    values: list[int] = []
    try:
        for part in parts:
            if not part:
                return None
            if part.startswith("0x"):
                values.append(int(part[2:], 16))
            elif len(part) > 1 and part.startswith("0"):
                values.append(int(part, 8))
            else:
                values.append(int(part, 10))
    except ValueError:
        return None
    if any(value < 0 for value in values):
        return None
    if len(values) == 1:
        total = values[0]
    else:
        if any(value > 255 for value in values[:-1]):
            return None
        remaining_bits = 8 * (5 - len(values))
        if values[-1] >= 1 << remaining_bits:
            return None
        total = values[-1]
        for index, value in enumerate(values[:-1]):
            total |= value << (8 * (3 - index))
    if total > 0xFFFFFFFF:
        return None
    return ipaddress.IPv4Address(total)


def canonical_ip(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Return a canonical literal IP without resolving a hostname."""
    candidate = value.strip("[]").split("%", maxsplit=1)[0]
    try:
        return ipaddress.ip_address(candidate)
    except ValueError:
        return _legacy_ipv4(candidate)


def is_public_ip(value: str) -> bool:
    """Allow only globally routable addresses; mapped IPv4 follows IPv4 policy."""
    address = canonical_ip(value)
    if address is None:
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return (
        address.is_global
        and not address.is_multicast
        and not address.is_reserved
        and not address.is_unspecified
        and not address.is_loopback
        and not address.is_link_local
        and not address.is_private
    )


def _domain_matches(hostname: str, domain: str) -> bool:
    suffix = domain.lower().strip().strip(".")
    return hostname == suffix or hostname.endswith(f".{suffix}")


def parse_external_url(
    raw_url: str,
    *,
    allowed_domains: tuple[str, ...] | None = None,
    denied_domains: tuple[str, ...] = (),
    allowed_ports: tuple[int, ...] = (80, 443),
) -> ParsedUrl:
    """Parse an HTTP(S) URL and reject credentials, metadata, and domain violations."""
    try:
        parsed = urlsplit(raw_url)
        port = parsed.port
    except ValueError as error:
        raise UrlPolicyError("invalid_url") from error
    if parsed.scheme not in {"http", "https"}:
        raise UrlPolicyError("scheme_not_allowed")
    if parsed.username is not None or parsed.password is not None:
        raise UrlPolicyError("userinfo_not_allowed")
    if parsed.hostname is None:
        raise UrlPolicyError("invalid_url")
    hostname = parsed.hostname.lower().rstrip(".")
    literal = canonical_ip(hostname)
    if literal is not None:
        hostname = str(literal)
    if hostname in METADATA_HOSTS:
        raise UrlPolicyError("domain_not_allowed")
    if any(_domain_matches(hostname, domain) for domain in denied_domains):
        raise UrlPolicyError("domain_not_allowed")
    if allowed_domains is not None and not any(
        _domain_matches(hostname, domain) for domain in allowed_domains
    ):
        raise UrlPolicyError("domain_not_allowed")
    effective_port = port or (443 if parsed.scheme == "https" else 80)
    if effective_port not in allowed_ports:
        raise UrlPolicyError("port_not_allowed")
    netloc_host = f"[{hostname}]" if ":" in hostname else hostname
    if port is not None:
        netloc_host = f"{netloc_host}:{port}"
    normalized = SplitResult(
        parsed.scheme,
        netloc_host,
        parsed.path,
        parsed.query,
        "",
    )
    return ParsedUrl(urlunsplit(normalized), hostname, effective_port, parsed.scheme)


def pin_destination(url: ParsedUrl, answers: tuple[str, ...]) -> PinnedDestination:
    """Reject empty, mixed, or non-public DNS answers and select a stable pin."""
    literal = canonical_ip(url.hostname)
    candidates = (str(literal),) if literal is not None else answers
    canonical = tuple(
        sorted(
            {
                str(address)
                for answer in candidates
                if (address := canonical_ip(answer)) is not None
            }
        )
    )
    if not canonical:
        raise UrlPolicyError("dns_resolution_failed")
    if len(canonical) != len(set(answers if literal is None else candidates)):
        raise UrlPolicyError("dns_answer_not_public")
    if any(not is_public_ip(address) for address in canonical):
        raise UrlPolicyError("dns_answer_not_public")
    return PinnedDestination(url, canonical[0], canonical)
