#!/usr/bin/env python3
"""Regenerate the Instruct family launcher icon.

Run from anywhere:  python3 scripts/make-family-icon.py

Writes public/icons/instruct-family-{512,192,180}.png, which
public/manifest-hub.webmanifest, the /hub route and the field route point at.

WHY THIS FILE EXISTS: without it the icon is an orphan binary whose proportions
nobody can justify. Everything here is deliberate and re-runnable:

  * The four accents are PARSED OUT OF src/styles.css rather than typed in, so
    if a product accent changes the icon can be regenerated to match instead of
    quietly going stale - and if a token is renamed this stops with an error
    rather than shipping a wrong colour.
  * The wordmark is measured, not guessed: the point size is solved for a target
    pixel width, so the lockup is the same size on any machine.
  * MASKABLE SIZING. Only the central circle of 80% diameter is guaranteed to
    survive whatever shape a device crops a maskable icon to, so the lockup is
    sized against that circle - half-diagonal 194px against a 205px radius - and
    the script refuses to write anything that would be cropped.

The wordmark is "instruct" in Audiowide, white, as the family rule requires, with
the four products as an accent rule beneath. The font is committed at
scripts/fonts/Audiowide-Regular.ttf under the SIL Open Font License (see
scripts/fonts/OFL.txt) so this runs without network access.

ALREADY TRIED AND REJECTED - please do not re-try these:
  * Four bars, no wordmark. Held up beautifully at 48px, but said nothing about
    the brand; the wordmark is worth more than the extra small-size crispness.
  * A 2x2 grid of tiles. Reads as an app drawer, not a logo.
  * A chunky lowercase "i" with a four-colour dot. At 48px it is a white capsule.
    A thin stem is what makes it a letter, and a thin stem cannot also fit the
    safe circle at a size worth reading.
The trade the wordmark makes: at 48px it softens into a white band. It is crisp
and readable at 60px and above, which is what home screens actually use.
"""
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "icons"
FONT_PATH = REPO / "scripts" / "fonts" / "Audiowide-Regular.ttf"
SIZE, SS = 512, 4
NAVY = "#24417B"
ORDER = ["brain", "site", "enterprise", "dabs"]  # the launcher's tile order
WORDMARK = "instruct"
TARGET_W = 360  # wordmark width in the 512 canvas; safe-circle limited
RULE_H = 36
GAP = 30


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


def solve_font(target_px: float) -> ImageFont.FreeTypeFont:
    """The size at which the wordmark measures target_px wide."""
    if not FONT_PATH.exists():
        sys.exit(f"STOP: {FONT_PATH} is missing; the icon cannot be drawn without it")
    for size in range(40, 400):
        font = ImageFont.truetype(str(FONT_PATH), size)
        if font.getlength(WORDMARK) >= target_px:
            return font
    sys.exit("STOP: could not reach the target wordmark width")


def accent_rule(w: int, h: int, accents: dict[str, str]) -> Image.Image:
    """The four products as one rule, each in its own accent."""
    img = Image.new("RGB", (w, h), tuple(int(NAVY[i : i + 2], 16) for i in (1, 3, 5)))
    gap = 8 * SS
    seg_w = (w - gap * 3) // 4
    for i, product in enumerate(ORDER):
        rgb = tuple(int(accents[product][j : j + 2], 16) for j in (1, 3, 5))
        top = tuple(int(rgb[c] + (255 - rgb[c]) * 0.16) for c in range(3))
        layer = Image.new("RGB", (seg_w, h))
        draw = ImageDraw.Draw(layer)
        for y in range(h):
            t = y / max(h - 1, 1)
            draw.line([(0, y), (seg_w, y)], fill=tuple(int(top[c] + (rgb[c] - top[c]) * t) for c in range(3)))
        mask = Image.new("L", (seg_w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, seg_w - 1, h - 1], radius=int(seg_w * 0.22), fill=255)
        img.paste(layer, (i * (seg_w + gap), 0), mask)
    return img


def build(accents: dict[str, str]) -> Image.Image:
    canvas = SIZE * SS
    font = solve_font(TARGET_W * SS)
    ascent, _ = font.getmetrics()
    bbox = font.getbbox(WORDMARK)
    text_w = bbox[2] - bbox[0]
    rule_h, gap = RULE_H * SS, GAP * SS
    total_h = ascent + gap + rule_h

    img = Image.new("RGB", (canvas, canvas), NAVY)
    ImageDraw.Draw(img).text(
        ((canvas - text_w) / 2 - bbox[0], (canvas - total_h) // 2 - bbox[1]),
        WORDMARK,
        font=font,
        fill=(255, 255, 255),
    )
    # The rule spans the wordmark, so the two form one lockup.
    rule_w = text_w
    img.paste(accent_rule(rule_w, rule_h, accents), ((canvas - rule_w) // 2, (canvas - total_h) // 2 + ascent + gap))
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    accents = accents_from_tokens()
    print("accents read from styles.css:", accents)
    master = build(accents)

    # Geometry is checked before anything is written.
    font = solve_font(TARGET_W * SS)
    ascent, _ = font.getmetrics()
    bbox = font.getbbox(WORDMARK)
    lockup_w = (bbox[2] - bbox[0]) / SS
    lockup_h = (ascent + GAP * SS + RULE_H * SS) / SS
    half_diagonal = ((lockup_w / 2) ** 2 + (lockup_h / 2) ** 2) ** 0.5
    safe = SIZE * 0.4
    print(f"lockup {lockup_w:.0f}x{lockup_h:.0f}px; half-diagonal {half_diagonal:.0f}px vs safe radius {safe:.0f}px")
    if half_diagonal > safe:
        sys.exit("STOP: the lockup falls outside the maskable safe circle; a device would crop it")

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
        masked = Image.new("RGB", (SIZE, SIZE), navy)
        masked.paste(master, (0, 0), mask)
        before = sum(1 for px in master.get_flattened_data() if px != navy)
        after = sum(1 for px in masked.get_flattened_data() if px != navy)
        print(f"{name:9} keeps {after}/{before} mark pixels ({100 * after / before:.1f}%)")
        if after != before:
            sys.exit(f"STOP: a {name} mask would crop the mark")

    os.makedirs(OUT, exist_ok=True)
    master.save(OUT / "instruct-family-512.png", "PNG", optimize=True)
    master.resize((192, 192), Image.LANCZOS).save(OUT / "instruct-family-192.png", "PNG", optimize=True)
    master.resize((180, 180), Image.LANCZOS).save(OUT / "instruct-family-180.png", "PNG", optimize=True)
    print("wrote instruct-family-512.png, -192.png, -180.png")


if __name__ == "__main__":
    main()
