#!/usr/bin/env python3
"""Regenerate the Instruct family launcher icon.

Run from anywhere:  python3 scripts/make-family-icon.py

Writes public/icons/instruct-family-{512,192,180}.png, which
public/manifest-hub.webmanifest and the /hub route both point at.

WHY THIS FILE EXISTS: without it the icon is an orphan binary. The four accents
are PARSED OUT OF src/styles.css rather than typed in here, so if a product
accent is ever changed the icon can be regenerated to match instead of quietly
going stale - and if a token is renamed, this stops with an error rather than
shipping a wrong colour.

MASKABLE SIZING: only the central circle of 80% diameter is guaranteed to survive
whatever shape a device crops a maskable icon to, so the mark is sized against
that circle (half-diagonal 195px against a 205px radius), not against the canvas.

DESIGNS ALREADY TRIED AND REJECTED - please do not re-try them:
  * A 2x2 grid of tiles. Reads as an app drawer, not a logo.
  * A chunky lowercase "i" with a four-colour dot. At 48px it is a white capsule.
    A thin stem is what makes it a letter, and a thin stem cannot also fit the
    safe circle at a size worth reading.
The four-bar mark was chosen because it holds up at 48px and reads as one mark.
"""
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "icons"
SIZE, SS = 512, 4
NAVY = "#24417B"
ORDER = ["brain", "site", "enterprise", "dabs"]  # the launcher's tile order
BAR_W, BAR_H, GAP = 60, 250, 20


def accents_from_tokens() -> dict[str, str]:
    css = (REPO / "src" / "styles.css").read_text()
    found = {}
    for product in ORDER:
        block = re.search(r'\.hub\[data-product="' + product + r'"\][^{]*\{(.*?)\}', css, re.S)
        if not block:
            sys.exit(f'STOP: no .hub[data-product="{product}"] token block in styles.css')
        token = re.search(r"--hub-accent:\s*(#[0-9a-fA-F]{6})", block.group(1))
        if not token:
            sys.exit(f"STOP: {product} has no --hub-accent in styles.css")
        found[product] = token.group(1).lower()
    return found


def bar(base: str, w: int, h: int, radius: int) -> tuple[Image.Image, Image.Image]:
    """One bar, with a slight top-light so it has depth at large sizes."""
    layer = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(layer)
    rgb = tuple(int(base[i : i + 2], 16) for i in (1, 3, 5))
    top = tuple(int(rgb[c] + (255 - rgb[c]) * 0.16) for c in range(3))
    for y in range(h):
        t = y / max(h - 1, 1)
        draw.line([(0, y), (w, y)], fill=tuple(int(top[c] + (rgb[c] - top[c]) * t) for c in range(3)))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return layer, mask


def build(accents: dict[str, str]) -> Image.Image:
    canvas = SIZE * SS
    img = Image.new("RGB", (canvas, canvas), NAVY)
    w, h, gap = BAR_W * SS, BAR_H * SS, GAP * SS
    total = w * len(ORDER) + gap * (len(ORDER) - 1)
    left, top = (canvas - total) // 2, (canvas - h) // 2
    for i, product in enumerate(ORDER):
        layer, mask = bar(accents[product], w, h, int(w * 0.30))
        img.paste(layer, (left + i * (w + gap), top), mask)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    accents = accents_from_tokens()
    print("accents read from styles.css:", accents)
    master = build(accents)
    os.makedirs(OUT, exist_ok=True)
    master.save(OUT / "instruct-family-512.png", "PNG", optimize=True)
    master.resize((192, 192), Image.LANCZOS).save(OUT / "instruct-family-192.png", "PNG", optimize=True)
    master.resize((180, 180), Image.LANCZOS).save(OUT / "instruct-family-180.png", "PNG", optimize=True)

    mark_w = BAR_W * 4 + GAP * 3
    half_diagonal = ((mark_w / 2) ** 2 + (BAR_H / 2) ** 2) ** 0.5
    safe = SIZE * 0.4
    print(f"mark {mark_w}x{BAR_H}px; half-diagonal {half_diagonal:.0f}px vs safe radius {safe:.0f}px")
    if half_diagonal > safe:
        sys.exit("STOP: the mark falls outside the maskable safe circle; a device will crop it")

    navy = tuple(int(NAVY[i : i + 2], 16) for i in (1, 3, 5))
    for name, shape in [
        ("circle", lambda d: d.ellipse([0, 0, SIZE - 1, SIZE - 1], fill=255)),
        (
            "squircle",
            lambda d: d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=int(SIZE * 0.23), fill=255),
        ),
    ]:
        mask = Image.new("L", (SIZE, SIZE), 0)
        shape(ImageDraw.Draw(mask))
        masked = Image.new("RGB", (SIZE, SIZE), NAVY)
        masked.paste(master, (0, 0), mask)
        before = sum(1 for px in master.get_flattened_data() if px != navy)
        after = sum(1 for px in masked.get_flattened_data() if px != navy)
        print(f"{name:9} keeps {after}/{before} mark pixels ({100 * after / before:.1f}%)")

    print("wrote instruct-family-512.png, -192.png, -180.png")


if __name__ == "__main__":
    main()
