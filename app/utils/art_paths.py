"""Resolve art files under art/."""

import logging
import os

FALLBACK_ART = "missing.png"
ART_ROOT = "art"


def get_art_image_path(rel_path: str) -> str:
    """
    Path under art/. Missing images fall back to missing.png.
    JSON/other sidecars do not use the fallback.
    """
    path = os.path.join(ART_ROOT, rel_path)
    if os.path.isfile(path):
        return path

    if not rel_path.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
        return path

    fallback = os.path.join(ART_ROOT, FALLBACK_ART)
    if os.path.isfile(fallback):
        logging.warning("Art missing for %r, using %s", rel_path, fallback)
        return fallback

    return path
