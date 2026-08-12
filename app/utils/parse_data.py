import logging
import yaml

from app.utils.character import Character, normalize_hex_color
from app.utils.paths import PRESETS_PATH


def extract_characters(query_string: str) -> list:
    """
    Extracts species, gender, height, name, and optional color from the query string.
    Returns a list of Character instances with defaults for missing values.
    """

    characters_list = []

    # '+' and spaces both separate characters (query decoders turn bare '+' into space)
    query_string = query_string.replace("+", " ")

    if query_string:
        for char_data in query_string.split(" "):
            try:
                parts = char_data.split(",")
                # species,gender,height,name[,color]
                padded = parts + ["unknown", "unknown", "60", "unknown"]
                species, gender, height, name = padded[:4]
                color = normalize_hex_color(parts[4]) if len(parts) >= 5 else None

                height = float(height) if height.replace(".", "", 1).isdigit() else 0.0

                characters_list.append(
                    Character(
                        name=name,
                        species=species,
                        height=height,
                        gender=gender,
                        color=color,
                    )
                )

            except ValueError as e:
                logging.warning(f"Error parsing character data '{char_data}': {e}")
                continue

    return characters_list


def generate_characters_query_string(characters_list: list) -> str:
    """Generates a query string from the list of Character instances."""
    return "+".join(char.to_query_string() for char in characters_list)


def _character_from_preset(preset: dict) -> Character:
    return Character(
        name=preset["name"],
        species=preset["species"],
        height=float(preset["height"]),
        gender=preset["gender"],
        color=preset.get("color"),
    )


def load_preset_characters():
    """
    Loads preset characters from data/presets.yaml.
    Keys: name, species, gender, height, optional description/color/default.
    """
    try:
        with open(PRESETS_PATH, "r") as f:
            data = yaml.safe_load(f) or {}
        return data.get("presets", [])
    except Exception as e:
        logging.warning(f"Could not load preset characters: {e}")
        return []


def get_default_characters():
    """Defaults are presets marked default: true (file order)."""
    defaults = [
        _character_from_preset(p)
        for p in load_preset_characters()
        if p.get("default")
    ]
    if defaults:
        return defaults
    # Fallback if yaml forgot the flags
    logging.warning("No default: true presets found; using first three presets")
    return [_character_from_preset(p) for p in load_preset_characters()[:3]]
