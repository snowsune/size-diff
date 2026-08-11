"""Lineup share previews (client-rendered PNGs for OG / Discord)."""

from __future__ import annotations

import hashlib
import re
import struct
import time
from pathlib import Path
from urllib.parse import urlencode

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_SHARES_ROOT = _PROJECT_ROOT / "data" / "shares"

SHARE_ID_RE = re.compile(r"^[a-f0-9]{16,64}$")
MAX_PNG_BYTES = 8 * 1024 * 1024
MIN_PREVIEW_BYTES = 2_000
EXPORT_WIDTH = 1200
EXPORT_HEIGHT = 630


def shares_root() -> Path:
    return _DEFAULT_SHARES_ROOT


def lineup_share_dir() -> Path:
    path = shares_root() / "lineup"
    path.mkdir(parents=True, exist_ok=True)
    return path


def canonicalize_lineup_query(
    characters: str,
    *,
    measure_ears: bool,
    scale_height: bool,
) -> str:
    """Stable query string so the same lineup always maps to the same cache key."""
    pairs = [("characters", characters.strip())]
    if not measure_ears:
        pairs.append(("measure_ears", "false"))
    if scale_height:
        pairs.append(("scale_height", "true"))
    return urlencode(pairs)


def share_id_for_query(query_string: str) -> str:
    """Internal filename only. Public URLs use /generate-image?..."""
    return hashlib.sha256(query_string.encode("utf-8")).hexdigest()[:32]


def lineup_png_path(share_id: str) -> Path:
    if not SHARE_ID_RE.match(share_id):
        raise ValueError("invalid share id")
    return (shares_root() / "lineup" / f"{share_id}.png").resolve()


def looks_like_png(data: bytes) -> bool:
    return len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n"


def preview_looks_valid(data: bytes) -> bool:
    """Real OG frames are ~1200x630. Tiny test squares dont count."""
    if not looks_like_png(data) or len(data) < MIN_PREVIEW_BYTES or len(data) < 33:
        return False
    if data[12:16] != b"IHDR":
        return False
    width, height = struct.unpack(">II", data[16:24])
    return width >= 600 and height >= 300


def lineup_preview_exists(share_id: str) -> bool:
    try:
        path = lineup_png_path(share_id)
    except ValueError:
        return False
    return path.is_file() and preview_looks_valid(path.read_bytes())


def save_lineup_preview(share_id: str, png_bytes: bytes) -> Path:
    lineup_share_dir()
    path = lineup_png_path(share_id)
    path.write_bytes(png_bytes)
    return path


_rate: dict[str, list[float]] = {}


def allow_upload(ip: str, *, limit: int = 20, window: float = 60.0) -> bool:
    now = time.time()
    bucket = _rate.setdefault(ip, [])
    _rate[ip] = [t for t in bucket if now - t < window]
    if len(_rate[ip]) >= limit:
        return False
    _rate[ip].append(now)
    return True
