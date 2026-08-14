import yaml

from app.utils.paths import SPECIES_DATA_DIR

# Default ambiguous species data
DEFAULT_DATA = {
    "male": {
        "image": "missing.png",
        "ears_offset": 0.0,
        "data": [
            {"anthro_size": 60, "height": 60},
            {"anthro_size": 1, "height": 1},
        ],
    },
    "female": {
        "image": "missing.png",
        "ears_offset": 0.0,
        "data": [
            {"anthro_size": 60, "height": 60},
            {"anthro_size": 1, "height": 1},
        ],
    },
}


def load_species_data(species_name):
    try:
        file_path = SPECIES_DATA_DIR / f"{species_name}.yaml"
        with open(file_path, "r") as file:
            data = yaml.safe_load(file)
        return data
    except FileNotFoundError:
        return DEFAULT_DATA


def list_species_names() -> list[str]:
    """Species ids from data/species_data/*.yaml (sorted)."""
    if not SPECIES_DATA_DIR.is_dir():
        return []
    return sorted(
        p.stem
        for p in SPECIES_DATA_DIR.glob("*.yaml")
        if p.is_file()
    )
