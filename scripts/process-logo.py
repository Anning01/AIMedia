#!/usr/bin/env python3
"""裁剪 Logo 白边并生成方形应用图标。"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def trim_white(src: Path, out: Path, padding: int = 24, threshold: int = 245) -> None:
    im = Image.open(src).convert("RGB")
    gray = im.convert("L")
    mask = gray.point(lambda v: 255 if v < threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        bbox = (0, 0, im.width, im.height)
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(im.width, bbox[2] + padding)
    bottom = min(im.height, bbox[3] + padding)
    im.crop((left, top, right, bottom)).save(out)


def make_icon(src: Path, out: Path, size: int = 256, bg=(255, 255, 255)) -> None:
    im = Image.open(src).convert("RGBA")
    scale = min(size / im.width, size / im.height)
    w = max(1, round(im.width * scale))
    h = max(1, round(im.height * scale))
    im2 = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (*bg, 255))
    canvas.paste(im2, ((size - w) // 2, (size - h) // 2), im2)
    canvas.convert("RGB").save(out)


if __name__ == "__main__":
    src, trimmed, icon = (Path(p) for p in sys.argv[1:4])
    trim_white(src, trimmed)
    make_icon(trimmed, icon)
    print(f"trimmed -> {trimmed} ({trimmed.stat().st_size} bytes)")
    print(f"icon    -> {icon} ({icon.stat().st_size} bytes)")
