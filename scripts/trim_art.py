#!/usr/bin/env python3
import os
import sys
from pathlib import Path

from PIL import Image

ART_ROOT = Path("art")
DIST_ROOT = ART_ROOT / "dist"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.utils.art_paths import is_companion_mask_file, mask_rel_path


def trim_image(src_path, dest_path, bbox=None):
    img = Image.open(src_path).convert("RGBA")
    if bbox is None:
        bbox = img.getbbox()
    if bbox:
        trimmed = img.crop(bbox)
    else:
        trimmed = img
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    trimmed.save(dest_path)
    return bbox


def should_trim(src, dest):
    if not dest.exists():
        return True
    return os.path.getmtime(src) > os.path.getmtime(dest)


def process_mask(src_path, bbox, parent_was_trimmed):
    mask_rel = mask_rel_path(str(src_path.relative_to(ART_ROOT)))
    mask_src = ART_ROOT / mask_rel
    if not mask_src.exists():
        return False

    mask_dest = DIST_ROOT / mask_rel
    if parent_was_trimmed or should_trim(mask_src, mask_dest):
        trim_image(mask_src, mask_dest, bbox=bbox)
        print(f"Trimmed mask: {mask_src} -> {mask_dest}")
        return True
    return False


def main():
    trimmed = 0
    masks_trimmed = 0
    skipped = 0

    for root, dirs, files in os.walk(ART_ROOT):
        if DIST_ROOT in map(lambda d: Path(root) / d, dirs):
            dirs.remove("dist")
        for file in files:
            if not file.lower().endswith(".png"):
                continue

            src_path = Path(root) / file
            if is_companion_mask_file(src_path):
                continue

            rel_path = src_path.relative_to(ART_ROOT)
            dest_path = DIST_ROOT / rel_path

            if should_trim(src_path, dest_path):
                bbox = trim_image(src_path, dest_path)
                print(f"Trimmed: {src_path} -> {dest_path}")
                trimmed += 1
                parent_was_trimmed = True
            else:
                bbox = Image.open(src_path).convert("RGBA").getbbox()
                skipped += 1
                parent_was_trimmed = False

            if process_mask(src_path, bbox, parent_was_trimmed):
                masks_trimmed += 1

    print(
        f"Done. Trimmed: {trimmed}, Masks: {masks_trimmed}, "
        f"Skipped (up-to-date): {skipped}"
    )


if __name__ == "__main__":
    main()
