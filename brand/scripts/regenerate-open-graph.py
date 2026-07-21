#!/usr/bin/env python3
"""
Regenerate opaque BlackStory Open Graph / social banners from approved lockups.

Composites brand/logos/*/BlackStory-primary-lockup-*-transparent.png onto solid
Black Ink / Archive Paper canvases at 1200x630, then writes brand/social masters
and the web + docs public copies. Open Graph assets must stay opaque — scrapers
flatten alpha poorly and will show RGB noise as static.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
W, H = 1200, 630
BLACK_INK = (0x0A, 0x0A, 0x0A, 255)
ARCHIVE_PAPER = (0xF4, 0xEF, 0xE5, 255)
TARGET_CONTENT_WIDTH = 488


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    im = im.convert("RGBA")
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 8:
                minx = min(minx, x)
                maxx = max(maxx, x)
                miny = min(miny, y)
                maxy = max(maxy, y)
    if maxx < 0:
        raise RuntimeError(f"no opaque content in {im}")
    return minx, miny, maxx, maxy


def build(lockup_path: Path, canvas_rgba: tuple[int, int, int, int], out_paths: list[Path]) -> None:
    lockup = Image.open(lockup_path).convert("RGBA")
    minx, miny, maxx, maxy = content_bbox(lockup)
    cropped = lockup.crop((minx, miny, maxx + 1, maxy + 1))
    scale = TARGET_CONTENT_WIDTH / cropped.width
    new_w = max(1, round(cropped.width * scale))
    new_h = max(1, round(cropped.height * scale))
    scaled = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (W, H), canvas_rgba)
    x = (W - new_w) // 2
    y = (H - new_h) // 2
    canvas.alpha_composite(scaled, (x, y))

    opaque = Image.new("RGB", (W, H), canvas_rgba[:3])
    opaque.paste(canvas, mask=canvas.split()[3])

    for out in out_paths:
        out.parent.mkdir(parents=True, exist_ok=True)
        opaque.save(out, format="PNG", optimize=True)
        print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")


def main() -> None:
    build(
        ROOT / "brand/logos/dark/BlackStory-primary-lockup-dark-transparent.png",
        BLACK_INK,
        [
            ROOT / "brand/social/dark/BlackStory-social-banner-dark-1200x630.png",
            ROOT / "apps/web/public/brand/open-graph-dark-1200x630.png",
            ROOT / "apps/docs/public/brand/open-graph-dark-1200x630.png",
        ],
    )
    build(
        ROOT / "brand/logos/light/BlackStory-primary-lockup-light-transparent.png",
        ARCHIVE_PAPER,
        [
            ROOT / "brand/social/light/BlackStory-social-banner-light-1200x630.png",
            ROOT / "apps/web/public/brand/open-graph-light-1200x630.png",
            ROOT / "apps/docs/public/brand/open-graph-light-1200x630.png",
        ],
    )
    print("Bump BRAND_ASSETS.openGraph ?v= and docs layout twin after regenerating.")


if __name__ == "__main__":
    main()
