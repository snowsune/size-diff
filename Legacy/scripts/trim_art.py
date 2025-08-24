#!/usr/bin/env python3
import os
from PIL import Image
from pathlib import Path
import shutil

ART_ROOT = Path("art")
DIST_ROOT = ART_ROOT / "dist"


def is_blank(pixel):
    # For RGBA, blank means alpha == 0
    return len(pixel) == 4 and pixel[3] == 0


def trim_image(src_path, dest_path):
    img = Image.open(src_path).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        trimmed = img.crop(bbox)
    else:
        trimmed = img  # fully blank? shouldn't happen
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    trimmed.save(dest_path)


def should_trim(src, dest):
    if not dest.exists():
        return True
    return os.path.getmtime(src) > os.path.getmtime(dest)


def main():
    trimmed = 0
    skipped = 0
    copied = 0
    for root, dirs, files in os.walk(ART_ROOT):
        # Skip the dist directory
        if DIST_ROOT in map(lambda d: Path(root) / d, dirs):
            dirs.remove("dist")
        for file in files:
            if not file.lower().endswith(".png"):
                continue
            src_path = Path(root) / file
            rel_path = src_path.relative_to(ART_ROOT)
            dest_path = DIST_ROOT / rel_path
            if should_trim(src_path, dest_path):
                trim_image(src_path, dest_path)
                print(f"Trimmed: {src_path} -> {dest_path}")
                trimmed += 1
            else:
                skipped += 1
    print(f"Done. Trimmed: {trimmed}, Skipped (up-to-date): {skipped}")


if __name__ == "__main__":
    main()
