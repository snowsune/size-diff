#!/usr/bin/env python3
"""
Downscale line art and fatten strokes for realllllly thin lineart
--vixi
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageFilter


def remap_joints(joints: dict, crop_box: tuple[int, int, int, int], scale: float) -> dict:
    ox, oy = crop_box[0], crop_box[1]
    out = {}
    for name, pt in joints.items():
        out[name] = {
            "x": round((pt["x"] - ox) * scale),
            "y": round((pt["y"] - oy) * scale),
        }
    return out


def decimate(
    src: Path,
    *,
    height: int,
    pad: int,
    max_filter: int,
    post_filter: int,
) -> Path:
    if max_filter % 2 == 0 or max_filter < 1:
        raise SystemExit("--max-filter must be an odd integer >= 1")
    if post_filter and post_filter % 2 == 0:
        raise SystemExit("--post-filter must be odd (or 0 to skip)")

    image = Image.open(src).convert("RGBA")
    bbox = image.getbbox()
    if not bbox:
        raise SystemExit(f"no visible pixels in {src}")
    crop_box = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(image.width, bbox[2] + pad),
        min(image.height, bbox[3] + pad),
    )
    cropped = image.crop(crop_box)
    _r, _g, _b, alpha = cropped.split()
    thick_alpha = alpha.filter(ImageFilter.MaxFilter(max_filter))
    black = Image.new("L", cropped.size, 0)
    thick = Image.merge("RGBA", (black, black, black, thick_alpha))

    scale = height / thick.height
    size = (max(1, round(thick.width * scale)), height)
    small = thick.resize(size, Image.Resampling.LANCZOS)
    if post_filter >= 3:
        _r, _g, _b, a2 = small.split()
        a2 = a2.filter(ImageFilter.MaxFilter(post_filter))
        black_s = Image.new("L", size, 0)
        small = Image.merge("RGBA", (black_s, black_s, black_s, a2))

    dest = src.with_name(f"{src.stem}_Decimated.png")
    small.save(dest, "PNG", optimize=True)

    sidecar = src.with_suffix(".json")
    if sidecar.is_file():
        data = json.loads(sidecar.read_text())
        data["name"] = dest.stem
        data["image"] = dest.name
        if "joints" in data:
            data["joints"] = remap_joints(data["joints"], crop_box, scale)
        dest.with_suffix(".json").write_text(json.dumps(data, indent=2) + "\n")

    print(f"{src.name} {image.size} -> {dest.name} {small.size}  scale={scale:.4f}")
    return dest


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("png", type=Path)
    p.add_argument("--height", type=int, default=2200)
    p.add_argument("--pad", type=int, default=24)
    p.add_argument(
        "--max-filter",
        type=int,
        default=7,
        help="odd PIL MaxFilter size on alpha before resize (was 11)",
    )
    p.add_argument(
        "--post-filter",
        type=int,
        default=0,
        help="odd MaxFilter after resize; 0 skips (first pass used 3)",
    )
    args = p.parse_args()
    decimate(
        args.png,
        height=args.height,
        pad=args.pad,
        max_filter=args.max_filter,
        post_filter=args.post_filter,
    )


if __name__ == "__main__":
    main()
