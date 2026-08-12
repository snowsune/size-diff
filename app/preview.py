"""Warm /tmp for /preview.png; Cloudflare caches the GET."""

from __future__ import annotations

import hashlib
import tempfile
from pathlib import Path

EXPORT_WIDTH = 1200
EXPORT_HEIGHT = 630
MAX_PNG_BYTES = 8 * 1024 * 1024


def normalize_characters_query(characters: str) -> str:
    # '+' and spaces both mean "next character" depending on how the URL was encoded
    return "+".join(part for part in characters.replace("+", " ").split() if part)


def preview_file(characters: str, *, measure_ears: bool, scale_height: bool) -> Path:
    bits = [normalize_characters_query(characters)]
    if not measure_ears:
        bits.append("ears=0")
    if scale_height:
        bits.append("scale=1")
    digest = hashlib.sha256("|".join(bits).encode()).hexdigest()[:32]
    root = Path(tempfile.gettempdir()) / "size-diff-previews"
    root.mkdir(exist_ok=True)
    return root / f"{digest}.png"
