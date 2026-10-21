"""Render share previews via Node + Painter's Canvas"""

from __future__ import annotations

import json
import logging
import os
import subprocess
from pathlib import Path

EXPORT_WIDTH = 1200
EXPORT_HEIGHT = 630
TAUR_EXPORT_WIDTH = 1200
TAUR_EXPORT_HEIGHT = 900

_log = logging.getLogger(__name__)
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_RENDER_SCRIPT = _PROJECT_ROOT / "scripts" / "render_preview.mjs"
_TAUR_RENDER_SCRIPT = _PROJECT_ROOT / "scripts" / "render_taur_preview.mjs"
_ART_ROOT = _PROJECT_ROOT / "art"


def normalize_characters_query(characters: str) -> str:
    # '+' and spaces both mean "next character" depending on how the URL was encoded
    return "+".join(part for part in characters.replace("+", " ").split() if part)


def _run_node_png(script: Path, payload: dict, *, art_root: Path) -> bytes:
    proc = subprocess.run(
        [
            "node",
            str(script),
            "--art-root",
            str(art_root),
        ],
        input=json.dumps(payload).encode("utf-8"),
        check=False,
        capture_output=True,
        timeout=120,
        cwd=str(_PROJECT_ROOT),
        env={
            **os.environ,
            "NODE_PATH": str(_PROJECT_ROOT / "node_modules"),
        },
    )
    if proc.returncode != 0 or not proc.stdout.startswith(b"\x89PNG\r\n\x1a\n"):
        detail = (proc.stderr or b"").decode("utf-8", "replace").strip() or (
            f"exit {proc.returncode}"
        )
        _log.error("preview render failed: %s", detail)
        raise RuntimeError(f"preview render failed: {detail}")
    return proc.stdout


def render_preview_png(lineup_payload: dict, *, art_root: Path | None = None) -> bytes:
    """Run Painter's Canvas under Node; PNG bytes on stdout, logs on stderr."""
    art = Path(art_root) if art_root else _ART_ROOT
    return _run_node_png(_RENDER_SCRIPT, lineup_payload, art_root=art)


def render_taur_preview_png(payload: dict, *, art_root: Path | None = None) -> bytes:
    """Render CalculaTAUR share preview via Node (same strategy as lineup)."""
    art = Path(art_root) if art_root else _ART_ROOT
    return _run_node_png(_TAUR_RENDER_SCRIPT, payload, art_root=art)
