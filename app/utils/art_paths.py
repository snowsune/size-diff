import os
from pathlib import Path

from app.utils.generate_image import get_dist_art_path


def mask_rel_path(rel_path: str) -> str:
    """Companion mask for art: ``foo.png`` -> ``foo_Mask.png``."""
    path = Path(rel_path)
    return str(path.parent / f"{path.stem}_Mask{path.suffix}")


def is_companion_mask_file(path: Path) -> bool:
    return path.stem.endswith("_Mask")


def dist_art_exists(rel_path: str) -> bool:
    return os.path.isfile(get_dist_art_path(rel_path))


def layer_asset_urls(layer_path: str, url_for_art) -> dict:
    """Build browser asset URLs for a layer and optional companion mask."""
    assets = {
        "url": url_for_art(layer_path),
        "path": layer_path,
    }
    mask_path = mask_rel_path(layer_path)
    if dist_art_exists(mask_path):
        assets["mask"] = {
            "url": url_for_art(mask_path),
            "path": mask_path,
        }
    return assets
