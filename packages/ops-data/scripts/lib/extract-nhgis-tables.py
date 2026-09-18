"""Extract bounded NHGIS CSV/codebook data from stdin into a private directory."""

import io
import os
from pathlib import Path
import stat
import sys
import zipfile

MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
MAX_ENTRY_BYTES = 512 * 1024 * 1024
MAX_TOTAL_BYTES = 1024 * 1024 * 1024
MAX_ENTRIES = 10_000


def extract_tables(directory: Path) -> None:
    payload = sys.stdin.buffer.read(MAX_ARCHIVE_BYTES + 1)
    if len(payload) > MAX_ARCHIVE_BYTES:
        raise ValueError("archive exceeds compressed byte limit")
    root = directory.resolve(strict=True)
    if not root.is_dir() or directory.is_symlink() or any(root.iterdir()):
        raise ValueError("extraction requires an empty private directory")
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > MAX_ENTRIES:
            raise ValueError("archive entry count is out of bounds")
        targets: set[Path] = set()
        files: list[tuple[zipfile.ZipInfo, Path]] = []
        expanded = 0
        for entry in entries:
            name = entry.orig_filename
            parts = name.rstrip("/").split("/")
            if (
                not name
                or "\\" in name
                or ":" in name
                or any(ord(character) < 32 for character in name)
                or any(part in ("", ".", "..") for part in parts)
            ):
                raise ValueError("unsafe archive path")
            target = (root / name).resolve()
            if not target.is_relative_to(root) or target == root or target in targets:
                raise ValueError("escaping or duplicate archive path")
            targets.add(target)
            kind = stat.S_IFMT(entry.external_attr >> 16)
            allowed_kind = stat.S_IFDIR if entry.is_dir() else stat.S_IFREG
            if kind not in (0, allowed_kind) or entry.flag_bits & 1:
                raise ValueError("links, devices and encrypted entries are forbidden")
            if entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise ValueError("unsupported archive compression")
            expanded += entry.file_size
            if entry.file_size > MAX_ENTRY_BYTES or expanded > MAX_TOTAL_BYTES:
                raise ValueError("archive exceeds expanded byte limit")
            if entry.is_dir():
                if entry.file_size:
                    raise ValueError("directory entry contains data")
                continue
            if target.suffix.lower() not in (".csv", ".txt"):
                raise ValueError("only CSV tables and text codebooks are allowed")
            files.append((entry, target))
        if not files:
            raise ValueError("archive contains no table or codebook files")
        file_paths = {target for _, target in files}
        if any(parent in file_paths for target in targets for parent in target.parents):
            raise ValueError("archive file conflicts with a directory")
        # Validate every entry before writing any data. Exclusive opens reject collisions.
        for entry, target in files:
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            descriptor = os.open(
                target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
            )
            with os.fdopen(descriptor, "wb") as output, archive.open(entry) as source:
                written = 0
                while chunk := source.read(1024 * 1024):
                    written += len(chunk)
                    if written > entry.file_size or written > MAX_ENTRY_BYTES:
                        raise ValueError("archive entry exceeds declared size")
                    output.write(chunk)
                if written != entry.file_size:
                    raise ValueError("archive entry size mismatch")


if __name__ == "__main__":
    extract_tables(Path(sys.argv[1]))
