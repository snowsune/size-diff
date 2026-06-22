import io

import numpy as np
from PIL import Image

from app.shares.storage import TAUR_EXPORT_HEIGHT, TAUR_EXPORT_WIDTH

MAX_PNG_BYTES = 2 * 1024 * 1024
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def validate_taur_png(data: bytes) -> tuple[Image.Image | None, str | None]:
    if len(data) > MAX_PNG_BYTES:
        return None, "image too large"

    if not data.startswith(PNG_MAGIC):
        return None, "not a PNG"

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception:
        return None, "invalid PNG"

    if image.format != "PNG":
        return None, "not a PNG"

    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    err = _looks_like_taur_render(image)
    if err:
        return None, err

    return image, None


def _looks_like_taur_render(image: Image.Image) -> str | None:
    """
    Rejects arbitrary uploads, kinda not so smart :<
    """
    width, height = image.size
    if width != TAUR_EXPORT_WIDTH or height != TAUR_EXPORT_HEIGHT:
        return "unexpected image dimensions"

    arr = np.asarray(image, dtype=np.uint8)
    if arr.ndim != 3 or arr.shape[2] != 3:
        return "unexpected image format"

    if not _corners_are_white(arr):
        return "image does not look like a calculator render"

    center_ratio = _non_white_ratio(_center_crop(arr, 0.55))
    if center_ratio < 0.04:
        return "image has no figure content"

    full_ratio = _non_white_ratio(arr)
    if full_ratio > 0.72:
        return "image is too full for a calculator render"

    return None


def _corners_are_white(arr: np.ndarray, *, min_mean: float = 228.0) -> bool:
    h, w, _ = arr.shape
    patch = max(10, min(h, w) // 18)
    corners = (
        arr[0:patch, 0:patch],
        arr[0:patch, w - patch : w],
        arr[h - patch : h, 0:patch],
        arr[h - patch : h, w - patch : w],
    )
    return all(float(region.mean()) >= min_mean for region in corners)


def _center_crop(arr: np.ndarray, fraction: float) -> np.ndarray:
    h, w, _ = arr.shape
    crop_h = max(1, int(h * fraction))
    crop_w = max(1, int(w * fraction))
    y0 = (h - crop_h) // 2
    x0 = (w - crop_w) // 2
    return arr[y0 : y0 + crop_h, x0 : x0 + crop_w]


def _non_white_ratio(arr: np.ndarray, *, threshold: int = 238) -> float:
    white = np.all(arr >= threshold, axis=2)
    return float(1.0 - white.mean())
