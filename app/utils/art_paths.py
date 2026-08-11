"""Figure out where art files actually live on disk."""

import logging
import os
from pathlib import Path

FALLBACK_ART = "missing.png"


def mask_rel_path(rel_path: str) -> str:
    """Companion mask for art: ``foo.png`` -> ``foo_Mask.png``."""
    path = Path(rel_path)
    return str(path.parent / f"{path.stem}_Mask{path.suffix}")


def is_companion_mask_file(path: Path) -> bool:
    return path.stem.endswith("_Mask")


def get_dist_art_path(rel_path: str) -> str:
    """Path under art/dist/ for a trimmed asset."""
    return os.path.join("art", "dist", rel_path)


def get_art_image_path(rel_path: str) -> str:
    """
    Prefer art/dist/, else art/.

    If theres a joint JSON sidecar next to the source png, use the source
    (joints were authored against that one, not the trimmed copy).

    Missing images fall back to missing.png. JSON/other sidecars do not.
    """
    source_path = os.path.join("art", rel_path)
    sidecar = os.path.splitext(source_path)[0] + ".json"
    if (
        rel_path.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))
        and os.path.isfile(sidecar)
        and os.path.isfile(source_path)
    ):
        return source_path

    for base in ("art/dist", "art"):
        path = os.path.join(base, rel_path)
        if os.path.isfile(path):
            return path

    # dont hand back a png when someone asked for json lol
    if not rel_path.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
        return os.path.join("art", rel_path)

    for base in ("art/dist", "art"):
        fallback = os.path.join(base, FALLBACK_ART)
        if os.path.isfile(fallback):
            logging.warning("Art missing for %r, using %s", rel_path, fallback)
            return fallback

    return os.path.join("art", rel_path)
