"""Paths to on-disk YAML data (species defs + presets)."""

from pathlib import Path

# Repo root: app/utils -> app -> repo
_REPO_ROOT = Path(__file__).resolve().parents[2]

SPECIES_DATA_DIR = _REPO_ROOT / "data" / "species_data"
PRESETS_PATH = _REPO_ROOT / "data" / "presets.yaml"
